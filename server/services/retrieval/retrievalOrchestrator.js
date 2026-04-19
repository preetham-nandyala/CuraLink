const OpenAlexService = require('./openAlexService');
const PubMedService = require('./pubmedService');
const ClinicalTrialsService = require('./clinicalTrialsService');
const CachedResult = require('../../models/CachedResult'); // FIX: MongoDB cache integration

/** In-memory Cache mapping expanded queries to finalized results */
const orchestratorCache = new Map();

/** Minimum total results before we warn — spec requires 50–300 */
const MIN_RESULT_THRESHOLD = 50;

/**
 * Retrieval Orchestrator
 * Coordinates parallel fetching from all 3 sources, merges results,
 * and validates retrieval volume against spec requirements.
 *
 * FIX: Volume validation — warns when total candidate pool is below spec minimum.
 * FIX: Rich metadata now includes per-source status for observability.
 */
class RetrievalOrchestrator {
  constructor() {
    this.openAlex = new OpenAlexService();
    this.pubmed = new PubMedService();
    this.clinicalTrials = new ClinicalTrialsService();
  }

  /**
   * Fetch from all sources in parallel
   * @param {Object} expandedQuery - Output from QueryExpander
   * @returns {Object} { publications, trials, metadata }
   */
  async retrieve(expandedQuery) {
    const startTime = Date.now();

    console.log('\n🔍 Starting parallel retrieval...');
    console.log(`   Query: "${expandedQuery.primary}"`);
    if (expandedQuery.disease) console.log(`   Disease: ${expandedQuery.disease}`);
    if (expandedQuery.location) console.log(`   Location: ${expandedQuery.location}`);
    if (expandedQuery.synonyms?.length) {
      console.log(`   Synonyms: ${expandedQuery.synonyms.join(', ')}`);
    }

    // Attempt to resolve from cache instantly
    const cacheKey = typeof expandedQuery === 'string' ? expandedQuery : JSON.stringify(expandedQuery);
    if (orchestratorCache.has(cacheKey)) {
      return orchestratorCache.get(cacheKey);
    }
    
    // Check MongoDB TTL cache
    try {
      const dbCache = await CachedResult.findOne({ queryKey: cacheKey });
      if (dbCache && dbCache.results) {
        orchestratorCache.set(cacheKey, dbCache.results);
        return dbCache.results;
      }
    } catch {}

    // Fire all 3 APIs simultaneously — Promise.allSettled ensures one failure
    // does not abort the others
    const [openAlexResult, pubmedResult, trialsResult] = await Promise.allSettled([
      this.openAlex.fetch(expandedQuery.openAlex),
      this.pubmed.fetch(expandedQuery.pubmed),
      this.clinicalTrials.fetch(expandedQuery.clinicalTrials),
    ]);

    // Unpack results — failed sources return empty arrays, never throw
    const openAlexPubs = openAlexResult.status === 'fulfilled' ? openAlexResult.value : [];
    const pubmedPubs = pubmedResult.status === 'fulfilled' ? pubmedResult.value : [];
    const trials = trialsResult.status === 'fulfilled' ? trialsResult.value : [];

    if (openAlexResult.status === 'rejected') {
      console.error('❌ OpenAlex completely failed:', openAlexResult.reason?.message);
    }
    if (pubmedResult.status === 'rejected') {
      console.error('❌ PubMed completely failed:', pubmedResult.reason?.message);
    }
    if (trialsResult.status === 'rejected') {
      console.error('❌ ClinicalTrials completely failed:', trialsResult.reason?.message);
    }

    if (openAlexResult.status === 'rejected' && pubmedResult.status === 'rejected' && trialsResult.status === 'rejected') {
      throw new Error('All external APIs failed. Please try again later or check your connection.');
    }

    // Merge publications with deduplication
    const allPublications = this._mergePublications(openAlexPubs, pubmedPubs);

    const elapsed = Date.now() - startTime;
    const totalRaw = openAlexPubs.length + pubmedPubs.length + trials.length;

    // Volume validation — warn if below spec minimum
    if (allPublications.length < MIN_RESULT_THRESHOLD) {
      console.warn(
        `⚠️  VOLUME WARNING: Only ${allPublications.length} publications in candidate pool ` +
        `(spec requires 50–300). Increase OPENALEX_PAGES, OPENALEX_PER_PAGE, or PUBMED_RETMAX.`
      );
    }

    const metadata = {
      totalRetrieved: totalRaw,
      openAlexCount: openAlexPubs.length,
      pubmedCount: pubmedPubs.length,
      trialsCount: trials.length,
      mergedPublications: allPublications.length,
      retrievalTimeMs: elapsed,
      meetsVolumeSpec: allPublications.length >= MIN_RESULT_THRESHOLD,
      sources: {
        openAlex: openAlexResult.status === 'fulfilled' ? 'success' : 'failed',
        pubmed: pubmedResult.status === 'fulfilled' ? 'success' : 'failed',
        clinicalTrials: trialsResult.status === 'fulfilled' ? 'success' : 'failed',
      },
    };

    console.log(`\n📊 Retrieval Complete in ${elapsed}ms:`);
    console.log(`   OpenAlex: ${openAlexPubs.length} | PubMed: ${pubmedPubs.length} | Trials: ${trials.length}`);
    console.log(`   Merged publications: ${allPublications.length} | Volume OK: ${metadata.meetsVolumeSpec}`);

    const finalResult = { publications: allPublications, trials, metadata };
    orchestratorCache.set(cacheKey, finalResult); // Saves response to memory
    
    // Save to MongoDB TTL cache asynchronously
    CachedResult.create({ queryKey: cacheKey, results: finalResult }).catch(() => {});

    return finalResult;
  }

  /**
   * Merge publications from OpenAlex and PubMed, removing duplicates.
   *
   * Priority order:
   * 1. DOI match (canonical)
   * 2. PMID match (PubMed-specific)
   * 3. Title fingerprint + year (fallback for preprints / older papers)
   *
   * OpenAlex is added first as it typically carries richer metadata
   * (citation counts, DOI, open access links).
   */
  _mergePublications(openAlexPubs, pubmedPubs) {
    const seen = new Set();
    const merged = [];

    const getKey = (pub) => {
      if (pub.doi) return `doi:${pub.doi.toLowerCase().replace('https://doi.org/', '')}`;
      if (pub.pmid) return `pmid:${pub.pmid}`;
      // Title fingerprint: normalise to alphanumeric only, first 60 chars + year
      const titleNorm = (pub.title || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 60);
      return `title:${titleNorm}_${pub.year || 'unknown'}`;
    };

    // OpenAlex first — richer metadata (citation counts, DOI, open-access)
    for (const pub of openAlexPubs) {
      const key = getKey(pub);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(pub);
      }
    }

    // PubMed — skip duplicates, but prefer PubMed abstract if OpenAlex version
    // has an empty abstract (inverted index reconstruction sometimes fails)
    for (const pub of pubmedPubs) {
      const key = getKey(pub);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(pub);
      } else {
        // Enrich existing OpenAlex entry with PubMed abstract if it's missing
        const existing = merged.find(p => getKey(p) === key);
        if (existing && !existing.abstract && pub.abstract) {
          existing.abstract = pub.abstract;
          existing.pmid = existing.pmid || pub.pmid;
        }
      }
    }

    return merged;
  }
}

module.exports = RetrievalOrchestrator;