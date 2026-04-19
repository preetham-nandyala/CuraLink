module.exports = {
  // API Endpoints
  OPENALEX_BASE: 'https://api.openalex.org/works',
  PUBMED_SEARCH: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
  PUBMED_FETCH: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi',
  CLINICAL_TRIALS_BASE: 'https://clinicaltrials.gov/api/v2/studies',

  // Retrieval Limits (OPTIMIZED — reduced fetch volume while keeping quality)
  OPENALEX_PER_PAGE: 25,     // Was 50 — top 25 per page is sufficient after reranking
  OPENALEX_PAGES: 2,          // Keep 2 pages for depth
  PUBMED_RETMAX: 50,          // Was 100 — PubMed XML parsing is the heaviest step
  CLINICAL_TRIALS_PAGE_SIZE: 20,  // Was 50 — we only show top 6 anyway

  // Re-ranking
  TOP_PUBLICATIONS: 5,
  TOP_TRIALS: 3,

  // Ranking Weights (RELEVANCE-HEAVY — topic match must dominate)
  RANK_WEIGHTS: {
    RELEVANCE: 0.50,   // Was 0.40 — this is the most important factor
    RECENCY: 0.20,     // Was 0.25 — recent is nice, but relevant is better
    CREDIBILITY: 0.15,
    QUALITY: 0.10,
    LOCATION: 0.05,    // Was 0.10 — location is a bonus, not a primary filter
  },

  // LLM (OPTIMIZED — tighter generation for quality + speed)
  LLM_TEMPERATURE: 0.2,         // Was 0.3 — lower = more deterministic, less rambling
  LLM_MAX_TOKENS: 4096,         // Rich structured JSON needs room
  CONTEXT_MESSAGE_PAIRS: 2,   // Was 3 — less history = smaller prompt = faster
};
