/**
 * Context Manager
 * Handles multi-turn conversation context tracking and follow-up intelligence.
 *
 * FIX: _hasDiseaseMention now normalises apostrophes before matching,
 *      so "Parkinson's" and "Alzheimer's" are detected correctly.
 * FIX: updateContext now accepts an optional `responseText` parameter
 *      to extract and persist new disease/treatment mentions surfaced by the LLM,
 *      preventing context drift across long conversations.
 * FIX: Informal phrasings ("sugar problems", "memory issues") partially handled
 *      via symptom-to-disease hint mapping.
 */
class ContextManager {
  constructor() {
    // Symptom/informal phrase → likely disease mapping
    // Reduces false negatives for lay language follow-ups
    this._symptomHints = {
      'memory': 'alzheimer',
      'forgetful': 'alzheimer',
      'tremor': 'parkinson',
      'shaking': 'parkinson',
      'sugar': 'diabetes',
      'glucose': 'diabetes',
      'chest pain': 'heart disease',
      'heart attack': 'heart disease',
      'breathless': 'asthma',
      'wheezing': 'asthma',
      'seizure': 'epilepsy',
      'convulsion': 'epilepsy',
      'joint pain': 'arthritis',
      'swollen joint': 'arthritis',
    };
  }

  /**
   * Update conversation context based on new query and optional LLM response.
   *
   * @param {Object} currentContext - Existing conversation context
   * @param {Object} queryInfo      - Expanded query information
   * @param {string} userQuery      - Raw user query
   * @param {string} [responseText] - LLM response text (optional, for context enrichment)
   * @returns {Object} Updated context
   */
  updateContext(currentContext, queryInfo, userQuery, responseText = '') {
    const ctx = { ...currentContext };

    if (!ctx.diseases) ctx.diseases = [];
    if (!ctx.topics) ctx.topics = [];
    if (!ctx.treatments) ctx.treatments = [];

    // Initialize Structured Medical Context State
    if (!ctx.contextState) {
      ctx.contextState = {
        disease: null,
        stage: null,
        mutation: null,
        treatmentIntent: null,
        biomarkers: [],
        patientIntent: null
      };
    }

    // Update disease from explicit query info
    if (queryInfo.disease) {
      const diseaseLower = queryInfo.disease.toLowerCase();
      if (!ctx.diseases.some(d => d.toLowerCase() === diseaseLower)) {
        ctx.diseases.unshift(queryInfo.disease);
      }
      ctx.lastDisease = queryInfo.disease;
      ctx.contextState.disease = queryInfo.disease; // Sync structured state
    }

    // Update modifiers if provided and not empty -> populate contextState
    if (queryInfo.modifiers) {
      if (!ctx.lastModifiers) ctx.lastModifiers = {};
      
      // Stage merge
      if (queryInfo.modifiers.stage?.length > 0) {
        ctx.lastModifiers.stage = queryInfo.modifiers.stage;
        ctx.contextState.stage = queryInfo.modifiers.stage.join(' ');
      }
      // Mutation merge
      if (queryInfo.modifiers.mutation?.length > 0) {
        ctx.lastModifiers.mutation = queryInfo.modifiers.mutation;
        ctx.contextState.mutation = queryInfo.modifiers.mutation.join(' ');
      }
      // Subtype/Biomarker merge
      if (queryInfo.modifiers.subtype?.length > 0) {
        ctx.lastModifiers.subtype = queryInfo.modifiers.subtype;
        const newBiomarkers = queryInfo.modifiers.subtype.filter(b => !ctx.contextState.biomarkers.includes(b));
        ctx.contextState.biomarkers = [...ctx.contextState.biomarkers, ...newBiomarkers];
      }
      // Intent merge
      if (queryInfo.modifiers.intent?.length > 0) {
        ctx.contextState.patientIntent = queryInfo.modifiers.intent.join(' ');
      }
    }

    // Extract topics and treatments from the user query
    const topics = this._extractTopics(userQuery);
    const treatments = this._extractTreatments(userQuery);

    for (const topic of topics) {
      if (!ctx.topics.includes(topic)) ctx.topics.unshift(topic);
    }
    for (const treatment of treatments) {
      if (!ctx.treatments.includes(treatment)) ctx.treatments.unshift(treatment);
    }

    // FIX: Also mine the LLM response for diseases/treatments it surfaced
    // This prevents context drift when the model mentions a new condition
    // in its answer that the user might follow up on.
    if (responseText) {
      const responseDiseases = this._extractDiseasesFromText(responseText);
      const responseTreatments = this._extractTreatments(responseText);

      for (const d of responseDiseases) {
        if (!ctx.diseases.some(existing => existing.toLowerCase() === d.toLowerCase())) {
          ctx.diseases.push(d); // append (lower priority than explicit user input)
        }
      }
      for (const t of responseTreatments) {
        if (!ctx.treatments.includes(t)) ctx.treatments.push(t);
      }
    }

    // Keep lists bounded
    ctx.diseases = ctx.diseases.slice(0, 10);
    ctx.topics = ctx.topics.slice(0, 20);
    ctx.treatments = ctx.treatments.slice(0, 15);
    ctx.lastQuery = userQuery;

    return ctx;
  }

  /**
   * Check if a query is a follow-up that needs context enrichment.
   *
   * @param {string} query   - New user query
   * @param {Object} context - Existing conversation context
   * @returns {Object} { isFollowUp, enrichedQuery, contextDisease, contextTopics }
   */
  analyzeFollowUp(query, context) {
    if (!context || !context.lastQuery) {
      return { isFollowUp: false, enrichedQuery: query };
    }

    const followUpPatterns = [
      /^(what about|how about|and what|also|can i|should i|is it|does it|will it)/i,
      /^(tell me more|more about|explain|elaborate|details)/i,
      /^(any|are there|is there|do they|have they)/i,
      /\b(it|this|that|these|those|the same)\b/i,
    ];

    const isFollowUp = followUpPatterns.some(p => p.test(query));
    const hasDiseaseRef = this._hasDiseaseMention(query);

    if (isFollowUp || (!hasDiseaseRef && context.lastDisease)) {
      return {
        isFollowUp: true,
        enrichedQuery: query,
        contextDisease: context.lastDisease,
        contextTopics: context.topics?.slice(0, 3) || [],
      };
    }

    return { isFollowUp: false, enrichedQuery: query };
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────

  _extractTopics(query) {
    const topics = [];
    const patterns = [
      /\b(treatment|therapy|medication|drug|surgery|procedure|intervention)\b/gi,
      /\b(diagnosis|screening|prevention|prognosis|survival)\b/gi,
      /\b(side effects|adverse effects|complications|risk factors)\b/gi,
      /\b(clinical trial|study|research|trial)\b/gi,
      /\b(gene therapy|immunotherapy|chemotherapy|radiation|stem cell)\b/gi,
      /\b(biomarker|genetic|genomic|molecular)\b/gi,
      /\b(vitamin|supplement|diet|nutrition|exercise)\b/gi,
    ];
    for (const pattern of patterns) {
      const matches = query.match(pattern);
      if (matches) topics.push(...matches.map(m => m.toLowerCase()));
    }
    return [...new Set(topics)];
  }

  _extractTreatments(text) {
    const treatments = [];
    const patterns = [
      /\b(deep brain stimulation|DBS)\b/gi,
      /\b(immunotherapy|chemotherapy|radiation therapy|targeted therapy)\b/gi,
      /\b(metformin|insulin|statin|aspirin|ibuprofen)\b/gi,
      /\b(vitamin [A-K]\d?|omega-?\d)\b/gi,
      /\b(CRISPR|CAR-T|monoclonal antibod(?:y|ies))\b/gi,
      /\b(empagliflozin|carvedilol|atenolol|ivabradine|dapagliflozin)\b/gi,
    ];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) treatments.push(...matches);
    }
    return [...new Set(treatments)];
  }

  /**
   * Check if query mentions any disease or disease-adjacent term.
   *
   * FIX: Normalises apostrophes before comparison so "Parkinson's" matches
   *      the keyword 'parkinson' (without relying on exact apostrophe style).
   * FIX: Checks symptom hints map for informal phrasings like "memory problems".
   */
  _hasDiseaseMention(query) {
    // Normalise apostrophes: ', ', `, ' → '
    const normalised = query.replace(/[''`]/g, "'").toLowerCase();

    const diseaseKeywords = [
      'cancer', 'diabetes', "alzheimer's", 'alzheimer', "parkinson's", 'parkinson',
      'heart disease', 'cardiovascular', 'hypertension', 'asthma', 'copd',
      'depression', 'anxiety', 'arthritis', 'multiple sclerosis', 'epilepsy',
      'stroke', 'hiv', 'hepatitis', 'leukemia', 'lymphoma', 'melanoma',
      'obesity', 'anemia', 'disease', 'syndrome', 'disorder', 'condition',
    ];

    if (diseaseKeywords.some(d => normalised.includes(d))) return true;

    // Symptom hint check — informal language like "memory issues" → alzheimer
    return Object.keys(this._symptomHints).some(hint => normalised.includes(hint));
  }

  /**
   * Extract disease mentions from LLM response text (for context enrichment).
   * Returns canonical disease names found in the response.
   */
  _extractDiseasesFromText(text) {
    const diseases = [];
    const diseasePatterns = [
      /\b(lung cancer|breast cancer|prostate cancer|colon cancer)\b/gi,
      /\b(type [12] diabetes|diabetes mellitus)\b/gi,
      /\b(alzheimer'?s?(?: disease)?|parkinson'?s?(?: disease)?)\b/gi,
      /\b(heart disease|cardiovascular disease|coronary artery disease)\b/gi,
      /\b(multiple sclerosis|amyotrophic lateral sclerosis)\b/gi,
      /\b(rheumatoid arthritis|osteoarthritis)\b/gi,
    ];
    for (const pattern of diseasePatterns) {
      const matches = text.match(pattern);
      if (matches) diseases.push(...matches.map(m => m.toLowerCase()));
    }
    return [...new Set(diseases)];
  }
}

module.exports = ContextManager;