const axios = require('axios');
const { OPENALEX_BASE, OPENALEX_PER_PAGE, OPENALEX_PAGES } = require('../../config/constants');

/**
 * Diseases where foundational literature predates 2018.
 * For these, we relax the date filter to 2010 so seminal papers
 * (e.g. landmark DBS trials, amyloid hypothesis studies) are not excluded.
 */
const ESTABLISHED_DISEASE_PATTERNS = [
  'alzheimer', 'parkinson', 'multiple sclerosis', 'epilepsy',
  'huntington', 'amyotrophic lateral sclerosis', 'als',
  'cystic fibrosis', 'deep brain stimulation', 'dbs',
];

/** Polite delay between OpenAlex requests (ms) */
const REQUEST_DELAY_MS = 200;

/**
 * OpenAlex API Service
 * Fetches research publications with pagination, retry logic,
 * query-aware date filtering, and robust deduplication.
 */
class OpenAlexService {
  /**
   * Fetch publications from OpenAlex
   * @param {Object} query - { search, searchExpanded }
   * @returns {Array} Normalized publication objects
   */
  async fetch(query) {
    try {
      const results = [];
      const dateFilter = this._getDateFilter(query.search);

      // Build parallel page fetches: multiple pages by relevance + 1 page by recency
      const pagePromises = [];
      for (let page = 1; page <= OPENALEX_PAGES; page++) {
        pagePromises.push(
          this._fetchPageWithRetry(query.search, page, 'relevance_score:desc', dateFilter)
        );
      }
      // Recency page surfaces recent preprints not yet highly cited
      pagePromises.push(
        this._fetchPageWithRetry(query.search, 1, 'publication_date:desc', dateFilter)
      );

      const pages = await Promise.allSettled(pagePromises);

      for (const result of pages) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(...result.value);
        }
      }

      // Robust deduplication: DOI preferred, then title+year fingerprint
      const seen = new Set();
      const unique = results.filter(item => {
        const key = this._dedupKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      console.log(`📚 OpenAlex: Retrieved ${unique.length} unique publications (date filter: ${dateFilter})`);

      // Warn if volume is below spec minimum (50)
      if (unique.length < 50) {
        console.warn(`⚠️  OpenAlex: Only ${unique.length} results — consider increasing OPENALEX_PAGES or OPENALEX_PER_PAGE`);
      }

      return unique;
    } catch (error) {
      console.error('❌ OpenAlex fetch error:', error.message);
      return [];
    }
  }

  /**
   * Generate a stable deduplication key.
   * DOI is canonical when available; otherwise we fingerprint by
   * normalised title prefix + year to handle minor title variations.
   */
  _dedupKey(item) {
    if (item.doi) return `doi:${item.doi.toLowerCase().replace('https://doi.org/', '')}`;
    const titleFingerprint = (item.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 60);
    return `title:${titleFingerprint}_${item.year || 'unknown'}`;
  }

  /**
   * Choose publication date filter based on query content.
   * Established neurological/genetic conditions have critical older literature;
   * fast-moving fields (oncology, COVID, AI-medicine) benefit from recency bias.
   */
  _getDateFilter(search) {
    const lower = (search || '').toLowerCase();
    const isEstablished = ESTABLISHED_DISEASE_PATTERNS.some(pattern => lower.includes(pattern));
    return isEstablished ? 'from_publication_date:2010-01-01' : 'from_publication_date:2018-01-01';
  }

  /**
   * Fetch a single page with exponential backoff retry.
   * Handles transient 429 / 5xx gracefully without silently returning empty.
   */
  async _fetchPageWithRetry(search, page, sort, dateFilter, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Only delay on retries, not the first attempt
        if (attempt > 1) await this._delay(REQUEST_DELAY_MS * attempt);
        return await this._fetchPage(search, page, sort, dateFilter);
      } catch (err) {
        const isRateLimit = err.response?.status === 429;
        const backoff = isRateLimit ? 3000 : Math.pow(2, attempt) * 400;

        if (attempt === retries) {
          console.warn(`⚠️  OpenAlex page ${page} (${sort}) failed after ${retries} attempts: ${err.message}`);
          return [];
        }
        console.warn(`⚠️  OpenAlex retry ${attempt}/${retries} for page ${page}, waiting ${backoff}ms`);
        await this._delay(backoff);
      }
    }
    return [];
  }

  /**
   * Fetch a single page of OpenAlex results
   */
  async _fetchPage(search, page, sort, dateFilter) {
    const params = {
      search,
      'per-page': OPENALEX_PER_PAGE,
      page,
      sort,
      filter: dateFilter,
    };

    const response = await axios.get(OPENALEX_BASE, {
      params,
      timeout: 8000,
      headers: {
        // Polite pool: OpenAlex prioritises requests with a contact email
        'User-Agent': 'Curalink/1.0 (mailto:curalink@research.ai)',
      },
    });

    if (!response.data || !response.data.results) return [];
    return response.data.results.map(work => this._normalize(work));
  }

  /**
   * Normalize OpenAlex work to unified publication schema
   */
  _normalize(work) {
    const doi = work.doi ? work.doi.replace('https://doi.org/', '') : '';
    return {
      type: 'publication',
      title: work.title || 'Untitled',
      abstract: this._reconstructAbstract(work.abstract_inverted_index),
      authors: (work.authorships || [])
        .slice(0, 5)
        .map(a => (a.author ? a.author.display_name : 'Unknown')),
      year: work.publication_year || null,
      url: doi ? `https://doi.org/${doi}` : (work.id || ''),
      doi: doi,
      platform: 'OpenAlex',
      citationCount: work.cited_by_count || 0,
      journal: work.primary_location?.source?.display_name || '',
    };
  }

  /**
   * Reconstruct abstract from OpenAlex inverted index format.
   * OpenAlex stores: { "word": [position1, position2, ...] }
   * Sparse positions are handled correctly via filter(Boolean).
   */
  _reconstructAbstract(invertedIndex) {
    if (!invertedIndex) return '';
    try {
      const words = [];
      for (const [word, positions] of Object.entries(invertedIndex)) {
        for (const pos of positions) {
          words[pos] = word;
        }
      }
      return words.filter(Boolean).join(' ');
    } catch {
      return '';
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = OpenAlexService;