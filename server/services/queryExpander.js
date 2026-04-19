const axios = require('axios');

/**
 * Query Expansion Engine
 * Uses a static medical synonym dictionary to eliminate the LLM call for common queries.
 * Falls back to LLM only when no local matches are found.
 *
 * FIX: Synonym map pre-sorted by key length in constructor (was sorted on every call — O(n log n) waste).
 * FIX: Disease extraction sorted list also moved to constructor (same issue).
 * FIX: Apostrophe normalisation in disease matching (e.g. "Parkinson's" now matches correctly).
 */
class QueryExpander {
  constructor() {
    // LLM fallback removed; relying purely on strong local static mapping
    // Pre-built medical synonym map.
    // Eliminates 8–15s Ollama synonym call for known conditions.
    this.synonymMap = {
      'cancer': ['neoplasm', 'malignancy', 'carcinoma', 'tumor', 'oncology'],
      'lung cancer': ['non-small cell lung cancer', 'NSCLC', 'small cell lung cancer', 'pulmonary neoplasm', 'lung carcinoma'],
      'breast cancer': ['mammary carcinoma', 'breast neoplasm', 'breast tumor', 'HER2 breast cancer', 'triple negative breast cancer'],
      'prostate cancer': ['prostatic neoplasm', 'prostate carcinoma', 'prostate adenocarcinoma'],
      'colon cancer': ['colorectal cancer', 'colorectal carcinoma', 'colon neoplasm', 'CRC'],
      'diabetes': ['diabetes mellitus', 'hyperglycemia', 'glycemic disorder', 'insulin resistance'],
      'type 1 diabetes': ['T1D', 'insulin-dependent diabetes', 'juvenile diabetes', 'autoimmune diabetes'],
      'type 2 diabetes': ['T2D', 'non-insulin-dependent diabetes', 'adult-onset diabetes', 'metabolic syndrome diabetes'],
      'alzheimer': ["alzheimer's disease", 'AD', 'senile dementia', 'amyloid plaque disease', 'neurodegenerative dementia'],
      "alzheimer's": ["alzheimer's disease", 'AD', 'senile dementia', 'amyloid plaque disease'],
      'parkinson': ["parkinson's disease", 'PD', 'parkinsonian syndrome', 'dopaminergic neurodegeneration'],
      "parkinson's": ["parkinson's disease", 'PD', 'parkinsonian syndrome', 'movement disorder'],
      'heart disease': ['cardiovascular disease', 'coronary artery disease', 'ischemic heart disease', 'CVD', 'cardiac disease'],
      'hypertension': ['high blood pressure', 'arterial hypertension', 'essential hypertension', 'HTN'],
      'asthma': ['bronchial asthma', 'reactive airway disease', 'airway hyperresponsiveness'],
      'copd': ['chronic obstructive pulmonary disease', 'emphysema', 'chronic bronchitis', 'COPD exacerbation'],
      'depression': ['major depressive disorder', 'MDD', 'clinical depression', 'depressive episode', 'mood disorder'],
      'anxiety': ['generalized anxiety disorder', 'GAD', 'anxiety disorder', 'panic disorder'],
      'arthritis': ['rheumatoid arthritis', 'osteoarthritis', 'inflammatory arthropathy', 'joint inflammation'],
      'multiple sclerosis': ['MS', 'demyelinating disease', 'autoimmune CNS disease', 'relapsing-remitting MS'],
      'epilepsy': ['seizure disorder', 'convulsive disorder', 'epileptic syndrome'],
      'stroke': ['cerebrovascular accident', 'CVA', 'ischemic stroke', 'brain infarction', 'hemorrhagic stroke'],
      'hiv': ['human immunodeficiency virus', 'HIV/AIDS', 'HIV infection', 'antiretroviral therapy'],
      'hepatitis': ['viral hepatitis', 'hepatitis B', 'hepatitis C', 'HCV', 'HBV', 'liver inflammation'],
      'tuberculosis': ['TB', 'mycobacterium tuberculosis', 'pulmonary tuberculosis', 'MDR-TB'],
      'leukemia': ['acute lymphoblastic leukemia', 'ALL', 'chronic myeloid leukemia', 'CML', 'blood cancer'],
      'lymphoma': ['non-Hodgkin lymphoma', 'Hodgkin lymphoma', 'lymphoid neoplasm', 'NHL'],
      'melanoma': ['malignant melanoma', 'cutaneous melanoma', 'skin cancer', 'metastatic melanoma'],
      'obesity': ['morbid obesity', 'overweight', 'BMI', 'adiposity', 'metabolic syndrome'],
      'vitamin d': ['cholecalciferol', '25-hydroxyvitamin D', 'calciferol', 'vitamin D supplementation', 'vitamin D deficiency'],
      'deep brain stimulation': ['DBS', 'neurostimulation', 'brain pacemaker', 'neuromodulation'],
      'immunotherapy': ['immune checkpoint inhibitor', 'PD-1 inhibitor', 'CAR-T therapy', 'immune-oncology'],
      'chemotherapy': ['cytotoxic therapy', 'antineoplastic agents', 'combination chemotherapy'],
    };

    // FIX: Sort disease list once here by length (longest first = most specific match wins).
    // Previously sorted on every _extractDiseaseFromQuery call — wasteful O(n log n) per query.
    this._sortedDiseases = [
      'lung cancer', 'breast cancer', 'prostate cancer', 'colon cancer',
      'type 1 diabetes', 'type 2 diabetes',
      "alzheimer's disease", "parkinson's disease",
      'cardiovascular disease', 'coronary artery disease',
      'myocardial infarction', 'heart attack',
      'chronic obstructive pulmonary disease',
      'rheumatoid arthritis', 'osteoarthritis',
      'multiple sclerosis', 'amyotrophic lateral sclerosis',
      'non-hodgkin lymphoma', 'hodgkin lymphoma',
      'heart disease', 'high blood pressure',
      'cancer', 'diabetes', 'alzheimer', "alzheimer's",
      'parkinson', "parkinson's", 'hypertension',
      'asthma', 'copd', 'depression', 'anxiety',
      'bipolar disorder', 'schizophrenia',
      'arthritis', 'epilepsy', 'stroke',
      'hiv', 'aids', 'hepatitis', 'tuberculosis',
      'leukemia', 'lymphoma', 'melanoma',
      'obesity', 'anemia', 'osteoporosis',
    ].sort((a, b) => b.length - a.length);

    // FIX: Pre-sorted synonym map keys (longest first) for correct matching priority
    this._sortedSynonymKeys = Object.keys(this.synonymMap)
      .sort((a, b) => b.length - a.length);
  }

  /**
   * Main expansion method
   * @param {Object} input   - { disease, query, location, patientName }
   * @param {Object} context - Previous conversation context
   * @returns {Object} Expanded query variants for each API
   */
  async expand(input, context = {}) {
    const startTime = Date.now();

    const resolved = this._resolveInput(input, context);
    const synonyms = this._getLocalSynonyms(resolved);

    const elapsed = Date.now() - startTime;
    console.log(`⚡ Query expanded in ${elapsed}ms | disease: "${resolved.disease}" | synonyms: ${synonyms.length}`);

    return {
      primary: resolved.combinedQuery,
      disease: resolved.disease,
      query: resolved.query,
      location: resolved.location,
      synonyms,
      openAlex: this._buildOpenAlexQuery(resolved, synonyms),
      pubmed: this._buildPubMedQuery(resolved, synonyms),
      clinicalTrials: this._buildClinicalTrialsQuery(resolved),
      expandedDescription: `"${resolved.combinedQuery}" with ${synonyms.length} synonym expansions`,
    };
  }

  /**
   * Resolve input — merges structured and natural language input with conversation context.
   * Context disease is used as fallback when query doesn't mention a disease (follow-up support).
   */
  _resolveInput(input, context) {
    let disease = input.disease || '';
    let query = input.query || input.content || '';
    let location = input.location || '';

    // Normalise apostrophes for consistent matching
    const normalise = s => s.replace(/[''`]/g, "'").toLowerCase().trim();
    disease = normalise(disease);
    query = query.trim();

    // Fall back to conversation context if no disease in current input
    if (!disease && context?.contextState?.disease) {
      disease = context.contextState.disease;
    }
    if (!disease && context?.lastDisease) {
      disease = context.lastDisease;
    }
    if (!disease && context?.diseases?.length > 0) {
      disease = context.diseases[0];
    }

    // Extract disease from natural language query if still not found
    if (!disease && query) {
      disease = this._extractDiseaseFromQuery(query);
    }

    // Noise Removal
    const { cleanQuery, extracted } = this._cleanNoiseAndExtract(query, disease);

    // Merge previous Structured Context State if they don't exist in the current query's extraction
    if (context && context.contextState) {
      if (extracted.stage.length === 0 && context.contextState.stage) {
        extracted.stage = context.contextState.stage.split(' ');
      }
      if (extracted.mutation.length === 0 && context.contextState.mutation) {
        extracted.mutation = context.contextState.mutation.split(' ');
      }
      if (extracted.subtype.length === 0 && context.contextState.subtype) {
        extracted.subtype = context.contextState.subtype.split(' ');
      }
    }

    // Combine: construct the full optimized query
    let combinedQuery = cleanQuery;
    if (disease && !normalise(cleanQuery).includes(normalise(disease))) {
      combinedQuery = `${cleanQuery} ${disease}`.trim();
    }
    
    // Append structured context state modifications if they aren't explicitly inside the cleanQuery
    const allMods = [...extracted.stage, ...extracted.mutation, ...extracted.subtype];
    for (const mod of allMods) {
      if (mod && !normalise(combinedQuery).includes(normalise(mod))) {
        combinedQuery = `${combinedQuery} ${mod}`.trim();
      }
    }

    return { 
      disease, 
      query: cleanQuery, 
      location, 
      combinedQuery,
      modifiers: extracted
    };
  }

  /**
   * STRICT NOISE REMOVAL & EXTRACTION
   * Removes conversational phrases, punctuation, and filler words.
   * Extracts stage, mutation, subtype, and clinical intent.
   */
  _cleanNoiseAndExtract(rawQuery, knownDisease) {
    let q = rawQuery.toLowerCase();

    // 1. Remove Conversational Phrases
    const conversational = [
      "i have", "should i", "what is the best", "can you tell me", "please", 
      "or should i", "tell me about", "research about", "are there any",
      "what are the", "help me find", "i am looking for", "difference between",
      "give me", "is there", "do we have"
    ];
    for (const phrase of conversational) {
      q = q.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), '');
    }

    // 2. Extract Modifiers (Stage, Mutation, Subtype)
    const extracted = {
      stage: [],
      mutation: [],
      subtype: [],
      intent: []
    };

    // Extract Stage
    const stageMatches = q.match(/\b(stage\s*[0-4ivx]+|early[\s-]stage|late[\s-]stage|advanced|metastatic)\b/gi);
    if (stageMatches) extracted.stage = [...new Set(stageMatches.map(m => m.trim()))];

    // Extract Mutations (Common Oncology)
    const mutationMatches = q.match(/\b(egfr|alk|kras|braft|ros1|her2|brca1|brca2|tp53|nras|pd-l1)\b/gi);
    if (mutationMatches) extracted.mutation = [...new Set(mutationMatches.map(m => m.trim().toUpperCase()))];

    // Extract Subtypes
    const subtypeMatches = q.match(/\b(nsclc|sclc|tnbc|hr\+|hr positive)\b/gi);
    if (subtypeMatches) extracted.subtype = [...new Set(subtypeMatches.map(m => m.trim().toUpperCase()))];

    // 3. Identify Intent
    const intentMatches = q.match(/\b(treatment(s)?|decision|comparison|trial(s)?|outcome(s)?|survival|surgery|radiation|chemo(therapy)?|immuno(therapy)?)\b/gi);
    if (intentMatches) extracted.intent = [...new Set(intentMatches.map(m => m.trim()))];

    // 4. Remove Punctuation & Extra Whitespace (keep alphanumeric and dashes)
    q = q.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();

    // Remove duplicate terms within the cleaned query
    const words = q.split(' ');
    q = [...new Set(words)].join(' ');

    return { cleanQuery: q, extracted };
  }

  /**
   * Extract disease from natural language query.
   * Uses pre-sorted list (longest match wins) to avoid "cancer" matching before "lung cancer".
   * Normalises apostrophes before comparison.
   */
  _extractDiseaseFromQuery(query) {
    const lowerQuery = query.toLowerCase().replace(/[''`]/g, "'");
    for (const disease of this._sortedDiseases) {
      if (lowerQuery.includes(disease)) {
        return disease;
      }
    }
    return '';
  }

  /**
   * Get synonyms from local dictionary.
   * Matches disease and combined query against pre-sorted keys (no LLM call required).
   * Returns at most 5 synonyms to keep query strings manageable.
   */
  _getLocalSynonyms(resolved) {
    const combined = resolved.combinedQuery.toLowerCase().replace(/[''`]/g, "'");
    const disease = resolved.disease.toLowerCase().replace(/[''`]/g, "'");
    const synonyms = new Set();

    for (const key of this._sortedSynonymKeys) {
      if (disease.includes(key) || combined.includes(key)) {
        this.synonymMap[key].forEach(v => synonyms.add(v));
      }
    }

    return [...synonyms].slice(0, 5);
  }

  /** Build OpenAlex search query */
  _buildOpenAlexQuery(resolved, synonyms) {
    return {
      search: resolved.combinedQuery,
      searchExpanded: synonyms.length > 0
        ? `${resolved.combinedQuery} OR ${synonyms.slice(0, 2).join(' OR ')}`
        : resolved.combinedQuery,
    };
  }

  /** Build PubMed MeSH-style query */
  _buildPubMedQuery(resolved, synonyms) {
    const primary = resolved.combinedQuery;
    let combined = primary;

    if (resolved.disease && resolved.query && resolved.disease !== resolved.query) {
      combined = `${resolved.query} AND ${resolved.disease}`;
    }
    if (synonyms.length > 0) {
      const synStr = synonyms.slice(0, 3).map(s => `"${s}"`).join(' OR ');
      combined = `(${combined}) OR (${synStr})`;
    }

    return { primary, combined };
  }

  /** Build ClinicalTrials.gov query */
  _buildClinicalTrialsQuery(resolved) {
    return {
      condition: resolved.disease || resolved.query,
      term: resolved.query || resolved.disease,
      location: resolved.location || '',
    };
  }
}

module.exports = QueryExpander;