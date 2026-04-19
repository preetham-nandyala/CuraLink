const axios = require('axios');
const { parseString } = require('xml2js');
const { promisify } = require('util');
const { PUBMED_SEARCH, PUBMED_FETCH, PUBMED_RETMAX } = require('../../config/constants');

const parseXml = promisify(parseString);

/**
 * NCBI API key from environment.
 * Without key: 3 req/s limit. With key: 10 req/s limit.
 * Get a free key at: https://www.ncbi.nlm.nih.gov/account/
 */
const NCBI_API_KEY = process.env.NCBI_API_KEY || '';

/**
 * Rate limit delay in ms.
 * Authenticated: 110ms (safe under 10/s). Anonymous: 400ms (safe under 3/s).
 */
const RATE_LIMIT_MS = NCBI_API_KEY ? 100 : 200;

/**
 * PubMed (NCBI) API Service
 * Two-step process: search for IDs → fetch full article details.
 *
 * FIX: Dual-sort strategy — fetches by both relevance and pub date,
 * then merges, giving the reranker a richer candidate pool.
 * FIX: Correct sort params passed as unencoded strings (axios handles encoding).
 * FIX: NCBI API key support for 3× higher rate limit.
 * FIX: Exponential backoff with 429-aware delay.
 */
class PubMedService {
  /**
   * Fetch publications from PubMed
   * @param {Object} query - { primary, combined }
   * @returns {Array} Normalized publication objects
   */
  async fetch(query) {
    try {
      const searchTerm = query.combined || query.primary;

      // Dual fetch: relevance covers topical accuracy; pub date covers recency
      // Note: 'pub date' is the correct unencoded NCBI sort value — axios
      // will encode the space correctly. 'pub+date' would encode as 'pub%2Bdate', which is wrong.
      const [relevanceResult, recencyResult] = await Promise.allSettled([
        this._searchIds(searchTerm, 'relevance'),
        this._searchIds(searchTerm, 'pub date'),
      ]);

      const relevanceIds = relevanceResult.status === 'fulfilled' ? relevanceResult.value : [];
      const recencyIds = recencyResult.status === 'fulfilled' ? recencyResult.value : [];

      // Merge with order preserved: relevance-ranked IDs first
      const allIds = [...new Set([...relevanceIds, ...recencyIds])];

      if (allIds.length === 0) {
        console.log('📄 PubMed: No results found');
        return [];
      }

      const publications = await this._fetchDetails(allIds);

      console.log(`📄 PubMed: Retrieved ${publications.length} publications (${relevanceIds.length} by relevance + ${recencyIds.length} by date, merged to ${allIds.length} unique IDs)`);

      if (publications.length < 20) {
        console.warn(`⚠️  PubMed: Low result count. Check PUBMED_RETMAX value (currently ${PUBMED_RETMAX}).`);
      }

      return publications;
    } catch (error) {
      console.error('❌ PubMed fetch error:', error.message);
      return [];
    }
  }

  /**
   * Step 1: Search PubMed for article IDs.
   * @param {string} term - Search term
   * @param {string} sort - Sort order: 'relevance' or 'pub date'
   */
  async _searchIds(term, sort) {
    const params = {
      db: 'pubmed',
      term,
      retmax: PUBMED_RETMAX,
      sort,
      retmode: 'json',
    };
    if (NCBI_API_KEY) params.api_key = NCBI_API_KEY;

    const response = await this._requestWithRetry(PUBMED_SEARCH, params);
    const result = response?.data?.esearchresult;
    if (!result || !result.idlist) return [];
    return result.idlist;
  }

  /**
   * Step 2: Fetch full article details by IDs in batches.
   * NCBI recommends max 200 IDs per efetch request; we use 100 for safety.
   */
  async _fetchDetails(ids) {
    const batchSize = 100;
    const allResults = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      try {
        await this._delay(RATE_LIMIT_MS);

        const params = {
          db: 'pubmed',
          id: batch.join(','),
          retmode: 'xml',
        };
        if (NCBI_API_KEY) params.api_key = NCBI_API_KEY;

        const response = await this._requestWithRetry(PUBMED_FETCH, params);
        const parsed = await parseXml(response.data);
        const articles = this._extractArticles(parsed);
        allResults.push(...articles);
      } catch (err) {
        console.warn(`⚠️  PubMed batch ${Math.floor(i / batchSize) + 1} fetch error: ${err.message}`);
      }
    }

    return allResults;
  }

  /**
   * Axios GET with exponential backoff retry.
   * Distinguishes 429 rate-limit (longer wait) from transient 5xx (shorter wait).
   */
  async _requestWithRetry(url, params, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await axios.get(url, { params, timeout: 10000 });
      } catch (err) {
        if (attempt === retries) throw err;
        const isRateLimit = err.response?.status === 429;
        const backoff = isRateLimit ? 3000 : Math.pow(2, attempt) * 400;
        console.warn(`⚠️  PubMed retry ${attempt}/${retries} (${err.response?.status || err.code}), waiting ${backoff}ms`);
        await this._delay(backoff);
      }
    }
  }

  /**
   * Extract and normalize articles from PubMed XML response.
   * Handles mixed-content XML nodes (object with _ key) gracefully.
   */
  _extractArticles(parsed) {
    const articles = [];

    try {
      const pubmedArticles = parsed?.PubmedArticleSet?.PubmedArticle || [];

      for (const article of pubmedArticles) {
        try {
          const medline = article.MedlineCitation?.[0];
          const articleData = medline?.Article?.[0];
          if (!articleData) continue;

          const pmid = medline?.PMID?.[0]?._ || medline?.PMID?.[0] || '';

          // Title: handle mixed-content XML (italic tags etc.)
          const titleRaw = articleData.ArticleTitle?.[0] || 'Untitled';
          const titleStr = typeof titleRaw === 'object'
            ? (titleRaw._ || JSON.stringify(titleRaw))
            : titleRaw;

          // Abstract: join structured abstract sections (Background, Methods, etc.)
          const abstractTexts = articleData.Abstract?.[0]?.AbstractText || [];
          const abstract = abstractTexts.map(t => {
            if (typeof t === 'string') return t;
            if (typeof t === 'object') {
              // Structured abstract: prefix with label if available
              const label = t.$?.Label ? `${t.$.Label}: ` : '';
              const content = t._ || '';
              return `${label}${content}`;
            }
            return '';
          }).join(' ').trim();

          // Authors (up to 5)
          const authorList = articleData.AuthorList?.[0]?.Author || [];
          const authors = authorList.slice(0, 5).map(a => {
            const last = a.LastName?.[0] || '';
            const first = a.ForeName?.[0] || a.Initials?.[0] || '';
            return `${last} ${first}`.trim();
          }).filter(Boolean);

          // Year: prefer Journal PubDate, fallback to MedlineDate
          const pubDate = articleData.Journal?.[0]?.JournalIssue?.[0]?.PubDate?.[0];
          let year = null;
          if (pubDate) {
            year = parseInt(pubDate.Year?.[0]) ||
              parseInt(pubDate.MedlineDate?.[0]?.substring(0, 4)) || null;
          }

          const journal = articleData.Journal?.[0]?.Title?.[0] || '';

          articles.push({
            type: 'publication',
            title: titleStr,
            abstract,
            authors,
            year,
            url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : '',
            pmid,
            platform: 'PubMed',
            journal,
          });
        } catch {
          // Skip individual malformed articles — do not abort the batch
        }
      }
    } catch (e) {
      console.warn('⚠️  PubMed XML parse issue:', e.message);
    }

    return articles;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PubMedService;