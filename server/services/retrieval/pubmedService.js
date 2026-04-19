const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const { PUBMED_SEARCH, PUBMED_FETCH, PUBMED_RETMAX } = require('../../config/constants');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  // Optional but helpful: always put certain tags in array even if single
  isArray: (name) => ['PubmedArticle', 'Author', 'AbstractText'].includes(name)
});

const NCBI_API_KEY = process.env.NCBI_API_KEY || '';
const RATE_LIMIT_MS = NCBI_API_KEY ? 100 : 200;

class PubMedService {
  async fetch(query) {
    try {
      const searchTerm = query.combined || query.primary;
      const [relevanceResult, recencyResult] = await Promise.allSettled([
        this._searchIds(searchTerm, 'relevance'),
        this._searchIds(searchTerm, 'pub date'),
      ]);

      const relevanceIds = relevanceResult.status === 'fulfilled' ? relevanceResult.value : [];
      const recencyIds = recencyResult.status === 'fulfilled' ? recencyResult.value : [];
      const allIds = [...new Set([...relevanceIds, ...recencyIds])];

      if (allIds.length === 0) return [];

      const publications = await this._fetchDetails(allIds);
      return publications;
    } catch (error) {
      console.error('❌ PubMed fetch error:', error.message);
      return [];
    }
  }

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
        
        // Fast XML Parser
        const parsed = parser.parse(response.data);
        const articles = this._extractArticles(parsed);
        allResults.push(...articles);
      } catch (err) {
        console.warn(`⚠️  PubMed batch ${Math.floor(i / batchSize) + 1} fetch error: ${err.message}`);
      }
    }
    return allResults;
  }

  async _requestWithRetry(url, params, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Axios Timeout 10000ms added
        return await axios.get(url, { params, timeout: 10000 });
      } catch (err) {
        if (attempt === retries) throw err;
        const isRateLimit = err.response?.status === 429;
        const backoff = isRateLimit ? 3000 : Math.pow(2, attempt) * 400;
        await this._delay(backoff);
      }
    }
  }

  _extractArticles(parsed) {
    const articles = [];
    try {
      const pubmedArticles = parsed?.PubmedArticleSet?.PubmedArticle || [];
      for (const article of pubmedArticles) {
        try {
          const medline = article.MedlineCitation;
          const articleData = medline?.Article;
          if (!articleData) continue;

          const pmid = medline?.PMID?.['#text'] || medline?.PMID || '';
          
          let titleStr = 'Untitled';
          if (articleData.ArticleTitle) {
            titleStr = typeof articleData.ArticleTitle === 'object' ? 
               (articleData.ArticleTitle['#text'] || JSON.stringify(articleData.ArticleTitle)) : 
               articleData.ArticleTitle;
          }

          let abstract = '';
          if (articleData.Abstract && articleData.Abstract.AbstractText) {
            const texts = Array.isArray(articleData.Abstract.AbstractText) 
              ? articleData.Abstract.AbstractText 
              : [articleData.Abstract.AbstractText];
            abstract = texts.map(t => {
              if (typeof t === 'string') return t;
              if (typeof t === 'object') {
                const label = t.Label ? `${t.Label}: ` : '';
                const content = t['#text'] || '';
                return `${label}${content}`;
              }
              return '';
            }).join(' ').trim();
          }

          const authorList = articleData.AuthorList?.Author || [];
          const authors = authorList.slice(0, 5).map(a => {
            const last = a.LastName || '';
            const first = a.ForeName || a.Initials || '';
            return `${last} ${first}`.trim();
          }).filter(Boolean);

          let year = null;
          const pubDate = articleData.Journal?.JournalIssue?.PubDate;
          if (pubDate) {
             year = parseInt(pubDate.Year) || parseInt((pubDate.MedlineDate || '').substring(0, 4)) || null;
          }

          articles.push({
            type: 'publication',
            title: titleStr,
            abstract,
            authors,
            year,
            url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : '',
            pmid,
            platform: 'PubMed',
            journal: articleData.Journal?.Title || '',
          });
        } catch { } // skip error article
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