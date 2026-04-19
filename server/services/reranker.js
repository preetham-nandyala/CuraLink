const embeddingService = require('./embeddingService');
const { RANK_WEIGHTS, TOP_PUBLICATIONS, TOP_TRIALS } = require('../config/constants');

/**
 * Re-Ranking Pipeline v2 — Embedding-Based
 *
 * Replaces keyword TF scoring with semantic cosine similarity
 * using local @xenova/transformers embeddings.
 *
 * Score = weighted combination of:
 *   - Semantic relevance (cosine similarity)
 *   - Recency (exponential decay)
 *   - Credibility (source + citations)
 *   - Quality (abstract presence/length)
 *   - Location (user preference match)
 */
class Reranker {
  /**
   * Re-rank publications and trials using embedding-based semantic similarity.
   * @param {Array}  publications - Merged publication results
   * @param {Array}  trials       - Clinical trial results
   * @param {Object} query        - Expanded query info
   * @returns {Object} { rankedPublications, rankedTrials }
   */
  async rank(publications, trials, query) {
    console.log(`\n🏆 Re-ranking ${publications.length} publications and ${trials.length} trials (embedding-based)...`);

    const startTime = Date.now();

    // Generate query embedding once
    const queryText = `${query.primary} ${query.disease || ''}`.trim();
    let queryEmbedding;
    try {
      queryEmbedding = await embeddingService.embed(queryText);
    } catch (err) {
      console.warn('⚠️  Embedding failed, falling back to keyword scoring:', err.message);
      return this._keywordFallback(publications, trials, query);
    }

    // Generate embeddings for all items in parallel
    const pubTexts = publications.map(pub => {
      const text = `${pub.title || ''} ${(pub.abstract || '').substring(0, 300)}`.trim();
      return text || 'no content';
    });

    const trialTexts = trials.map(trial => {
      const text = `${trial.title || ''} ${(trial.abstract || '').substring(0, 300)}`.trim();
      return text || 'no content';
    });

    let pubEmbeddings, trialEmbeddings;
    try {
      [pubEmbeddings, trialEmbeddings] = await Promise.all([
        embeddingService.embedBatch(pubTexts),
        embeddingService.embedBatch(trialTexts),
      ]);
    } catch (err) {
      console.warn('⚠️  Batch embedding failed, falling back to keyword scoring:', err.message);
      return this._keywordFallback(publications, trials, query);
    }

    // 1. Clinical Term Protection Map
    const clinicalMap = {
      "heart attack": ["myocardial infarction", "acs", "cardiovascular"],
      "lung cancer": ["nsclc", "small cell lung cancer", "carcinoma", "lung neoplasm"],
      "heart disease": ["cardiovascular", "coronary", "myocardial"],
      "diabetes": ["t2dm", "t1dm", "diabetic"]
    };

    const getProtectedTerms = (disease) => {
      if (!disease) return [];
      const d = disease.toLowerCase();
      const terms = [d];
      for (const [key, aliases] of Object.entries(clinicalMap)) {
        if (d.includes(key)) terms.push(...aliases);
      }
      return terms;
    };

    const protectedTerms = getProtectedTerms(query.disease);
    const intentHint = query.primary.toLowerCase().includes('survival') ? ['survival', 'progression-free', 'mortality'] : [];

    // 1. Detect Intent: Epidemiology & Core Risk Factors
    const queryLower = query.primary.toLowerCase();
    
    const isEpiQuery = ['cases', 'incidence', 'prevalence', 'trends', 'recent', 'epidemiology'].some(k => queryLower.includes(k));
    const epiBoostTerms = ['incidence', 'prevalence', 'epidemiology', 'registry', 'population-based', 'cohort study'];
    
    const isEtiologyQuery = ['risk factors', 'trends', 'causes', 'associations', 'etiology', 'lifestyle'].some(k => queryLower.includes(k));
    const coreRiskBoostTerms = ['smoking', 'diabetes', 'hypertension', 'obesity', 'cholesterol', 'lifestyle', 'sedentary', 'age', 'genetics', 'bmi', 'diet', 'family history'];
    
    // Universal novelty penalizers mapping
    const caseReportTerms = ['case report', 'rare case', 'single patient', 'emerging biomarker', 'experimental', 'rare finding'];

    // Score publications
    const scoredPubsTrimmed = [];
    publications.forEach((pub, i) => {
      const titleAbs = (`${pub.title || ''} ${pub.abstract || ''}`).toLowerCase();
      
      // 2. Hard Keyword Guard (Pre-Filter) + Abstract Requirement + Medical Jargon Guard
      if (!pub.abstract || pub.abstract.trim().length === 0) return; // Drop if no abstract

      // Drop theoretical physics/math jargon often returned by word-ambiguity
      const nonMedJargon = ['ad-s', 'anti-de sitter', 'quantum gravity', 'string theory', 'de rham', 'mathematical physics', 'logic', 'computational complexity'];
      if (nonMedJargon.some(j => titleAbs.includes(j))) return;

      if (protectedTerms.length > 0) {
        const hasKeyword = protectedTerms.some(term => titleAbs.includes(term));
        if (!hasKeyword) return; // Drop completely
      }

      let semanticScore = embeddingService.cosineSimilarity(queryEmbedding, pubEmbeddings[i]);
      
      // 3. Intent Keyword Hint (Soft Filter Boost)
      if (intentHint.length > 0 && intentHint.some(term => titleAbs.includes(term))) {
        semanticScore += 0.15; // Soft boost
      }

      // 4. Intent & Keyword Handling (Epidemiology + Risk Factors)
      if (isEpiQuery && epiBoostTerms.some(term => titleAbs.includes(term))) {
        semanticScore += 0.15; // Boost registry and population studies
      }
      
      if (isEtiologyQuery && coreRiskBoostTerms.some(term => titleAbs.includes(term))) {
        semanticScore += 0.20; // Aggressively boost primary generalized clinical factors
      }

      // Downweight experimental anomalies if the user isn't expressly asking for rare cases
      if (!queryLower.includes('rare') && caseReportTerms.some(term => titleAbs.includes(term))) {
        semanticScore -= 0.25; // Heavily penalize isolated case reports & emerging biomarkers to protect dominant consensus
      }

      const recency = this._recencyScore(pub.year);
      const credibility = this._credibilityScore(pub);
      const quality = this._qualityScore(pub);
      const location = this._locationScore(pub, query.location);

      const score =
        semanticScore * RANK_WEIGHTS.RELEVANCE +
        recency * RANK_WEIGHTS.RECENCY +
        credibility * RANK_WEIGHTS.CREDIBILITY +
        quality * RANK_WEIGHTS.QUALITY +
        location * RANK_WEIGHTS.LOCATION;

      scoredPubsTrimmed.push({ ...pub, score, semanticScore });
    });
    
    // 4. Ensure Diversity (No duplicate titles)
    const uniqueScoredPubs = [];
    const seenPubTitles = new Set();
    scoredPubsTrimmed.sort((a, b) => b.score - a.score).forEach(pub => {
      const normalizedTitle = (pub.title || '').toLowerCase().substring(0, 30);
      if (!seenPubTitles.has(normalizedTitle)) {
        seenPubTitles.add(normalizedTitle);
        uniqueScoredPubs.push(pub);
      }
    });

    // Score trials
    const scoredTrials = trials.map((trial, i) => {
      const semanticScore = embeddingService.cosineSimilarity(queryEmbedding, trialEmbeddings[i]);
      const recency = this._recencyScore(trial.year);
      const credibility = this._trialCredibilityScore(trial);
      const quality = trial.abstract ? 0.7 : 0.3;
      const location = trial.locationMatch ? 1.0 : this._locationScore(trial, query.location);

      const score =
        semanticScore * RANK_WEIGHTS.RELEVANCE +
        recency * RANK_WEIGHTS.RECENCY +
        credibility * RANK_WEIGHTS.CREDIBILITY +
        quality * RANK_WEIGHTS.QUALITY +
        location * RANK_WEIGHTS.LOCATION;

      return { ...trial, score, semanticScore };
    });
    scoredTrials.sort((a, b) => b.score - a.score);

    // Hard relevance cutoff
    const MIN_PUB_SCORE = 0.12;
    const MIN_TRIAL_SCORE = 0.08;

    const filteredPubs = uniqueScoredPubs.filter(p => p.score >= MIN_PUB_SCORE);
    const filteredTrials = scoredTrials.filter(t => t.score >= MIN_TRIAL_SCORE);

    const pubsDiscarded = uniqueScoredPubs.length - filteredPubs.length;
    const trialsDiscarded = scoredTrials.length - filteredTrials.length;

    if (pubsDiscarded > 0) console.log(`   🗑️  Discarded ${pubsDiscarded} publications below threshold`);
    if (trialsDiscarded > 0) console.log(`   🗑️  Discarded ${trialsDiscarded} trials below threshold`);

    // Top-K Strictness: Output 6 publications and 5 clinical trials to match prompt expectations
    let rankedPubs = filteredPubs.slice(0, 6);
    let rankedTrials = filteredTrials.slice(0, 5);

    // TRUNCATE ABSTRACTS TO PROTECT LLM TOKEN LIMITS
    rankedPubs = rankedPubs.map(pub => {
      if (pub.abstract && pub.abstract.length > 700) {
        return { ...pub, abstract: pub.abstract.substring(0, 700) + '...' };
      }
      return pub;
    });

    rankedTrials = rankedTrials.map(trial => {
      if (trial.abstract && trial.abstract.length > 700) {
        return { ...trial, abstract: trial.abstract.substring(0, 700) + '...' };
      }
      return trial;
    });
    const elapsed = Date.now() - startTime;
    console.log(`   ✅ Re-ranked in ${elapsed}ms`);
    console.log(`   ✅ Top ${rankedPubs.length} publications | best: ${rankedPubs[0]?.score?.toFixed(3) || 0} (semantic: ${rankedPubs[0]?.semanticScore?.toFixed(3) || 0})`);
    console.log(`   ✅ Top ${rankedTrials.length} trials      | best: ${rankedTrials[0]?.score?.toFixed(3) || 0}`);

    return { rankedPublications: rankedPubs, rankedTrials };
  }

  // ─────────────────────────────────────────────────────────────
  // Factor scores (kept from v1)
  // ─────────────────────────────────────────────────────────────

  _recencyScore(year) {
    if (!year) return 0.3;
    const age = new Date().getFullYear() - year;
    if (age < 0) return 1.0;
    return Math.exp(-0.15 * age);
  }

  _credibilityScore(pub) {
    let score = 0.5;
    if (pub.platform === 'PubMed') score += 0.3;
    else if (pub.platform === 'OpenAlex') score += 0.2;
    if (pub.citationCount > 100) score += 0.2;
    else if (pub.citationCount > 20) score += 0.1;
    return Math.min(1.0, score);
  }

  _trialCredibilityScore(trial) {
    let score = 0.5;
    switch (trial.status) {
      case 'RECRUITING': score += 0.30; break;
      case 'ACTIVE_NOT_RECRUITING': score += 0.20; break;
      case 'COMPLETED': score += 0.15; break;
    }
    const phases = (trial.phases || '').toLowerCase();
    if (phases.includes('phase 3') || phases.includes('phase3')) score += 0.20;
    else if (phases.includes('phase 2') || phases.includes('phase2')) score += 0.15;
    else if (phases.includes('phase 1') || phases.includes('phase1')) score += 0.10;
    return Math.min(1.0, score);
  }

  _qualityScore(pub) {
    let score = 0.3;
    if (pub.abstract) {
      score += 0.3;
      if (pub.abstract.length > 200) score += 0.2;
      const lower = pub.abstract.toLowerCase();
      if (lower.includes('conclusion') || lower.includes('results') || lower.includes('findings')) {
        score += 0.2;
      }
    }
    return Math.min(1.0, score);
  }

  _locationScore(item, userLocation) {
    if (!userLocation) return 0.0;
    const locationLower = userLocation.toLowerCase();
    const itemLocation = (item.location || '').toLowerCase();
    const locations = (item.locations || []).map(l => l.toLowerCase());

    if (itemLocation.includes(locationLower) || locations.some(l => l.includes(locationLower))) {
      return 1.0;
    }
    const locationParts = locationLower.split(/[,\s]+/).filter(p => p.length > 2);
    for (const part of locationParts) {
      if (itemLocation.includes(part) || locations.some(l => l.includes(part))) return 0.7;
    }
    return 0.0;
  }

  // ─────────────────────────────────────────────────────────────
  // Keyword fallback (when embedding model fails to load)
  // ─────────────────────────────────────────────────────────────

  _keywordFallback(publications, trials, query) {
    console.log('   ⚠️  Using keyword fallback ranking');
    const queryTerms = this._extractTerms(query.primary);

    const scored = publications.map(pub => ({
      ...pub,
      score: this._keywordRelevance(pub.title, pub.abstract, queryTerms),
    }));
    scored.sort((a, b) => b.score - a.score);

    const scoredTrials = trials.map(trial => ({
      ...trial,
      score: this._keywordRelevance(trial.title, trial.abstract, queryTerms),
    }));
    scoredTrials.sort((a, b) => b.score - a.score);

    return {
      rankedPublications: scored.slice(0, TOP_PUBLICATIONS),
      rankedTrials: scoredTrials.slice(0, TOP_TRIALS),
    };
  }

  _keywordRelevance(title, abstract, queryTerms) {
    if (!queryTerms.length) return 0.5;
    const titleLower = (title || '').toLowerCase();
    const abstractLower = (abstract || '').toLowerCase();
    let titleHits = 0, abstractHits = 0;
    for (const term of queryTerms) {
      if (titleLower.includes(term)) titleHits++;
      if (abstractLower.includes(term)) abstractHits++;
    }
    return Math.min(1.0, (titleHits / queryTerms.length) * 0.6 + (abstractHits / queryTerms.length) * 0.4);
  }

  _extractTerms(query) {
    if (!query) return [];
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'what', 'which', 'who',
      'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we',
      'our', 'latest', 'recent', 'new', 'top', 'best',
    ]);
    return query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  }
}

module.exports = Reranker;