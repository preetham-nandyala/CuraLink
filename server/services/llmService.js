const Groq = require('groq-sdk');
const { LLM_TEMPERATURE, LLM_MAX_TOKENS } = require('../config/constants');

/**
 * LLM Reasoning Engine v5 — Intent-Based Adaptive Synthesis
 *
 * Dynamically adjusts response structure based on detected intent:
 * PUBLICATIONS, CLINICAL_TRIALS, or GENERAL_MEDICAL.
 */
class LLMService {
  constructor() {
    this.groq1 = new Groq({ apiKey: process.env.GROQ_API_KEY });
    // Use second key if available, otherwise fallback to the first key
    this.groq2 = new Groq({ apiKey: process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY });
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  async generateResponse({ userQuery, publications, trials, context, history, queryInfo }) {
    const intent = this._detectIntent(userQuery, history);
    
    // Immediate rejection for NON_MEDICAL
    if (intent === 'NON_MEDICAL') {
      return JSON.stringify({
        condition_overview: "This system is designed for medical and research-related queries. Please ask about diseases, treatments, research, or clinical trials.",
        research_insights: ["Non-medical query detected."],
        treatment_direction: "",
        patient_summary: "Please refine your query to focus on medical or clinical research.",
        key_takeaway: "Query outside of medical scope.",
        limitations: "",
        clinical_trials: [],
        publications: []
      });
    }

    const messages = this._buildMessages({ userQuery, publications, trials, context, history, queryInfo, intent });

    try {
      const completion = await this.groq1.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: LLM_MAX_TOKENS,
        temperature: LLM_TEMPERATURE,
        response_format: { type: 'json_object' },
      });

      const jsonStr = completion.choices[0]?.message?.content || '{}';
      JSON.parse(jsonStr); // validate
      return jsonStr;
    } catch (error) {
      console.error('❌ LLM generation error:', error.message);
      return this._fallbackResponse(publications, trials, userQuery);
    }
  }

  async cleanQuery(userQuery) {
    const prompt = `You are a medical query optimizer.

Your task is to convert a noisy user query into clean keywords for medical search APIs.
REMOVE: conversational phrases, pronouns, filler words.
KEEP: disease, stage, mutation, subtype, essential medical terms.

OUTPUT: Single clean string.

Input: "${userQuery}"
Output:`;

    try {
      const completion = await this.groq1.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.1,
      });

      return completion.choices[0]?.message?.content?.trim() || userQuery;
    } catch (error) {
      console.error('❌ LLM cleanQuery error:', error.message);
      return userQuery;
    }
  }

  async validateMedicalIntent(userQuery, conversationHistory = []) {
    const q = (userQuery || '').toLowerCase().trim();
    
    // Hard-coded fast path for common debris (only when NO conversation context)
    const trivial = ["hi", "hello", "hey", "test", "thanks", "thank you", "how are you", "who are you"];
    if (trivial.includes(q) && conversationHistory.length === 0) return 'NON_MEDICAL';

    // If there's conversation history, build context summary for the LLM
    let contextHint = '';
    if (conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-4).map(m => {
        const content = typeof m.content === 'string' ? m.content.substring(0, 100) : '';
        return `${m.role}: "${content}"`;
      }).join('\n');
      contextHint = `\nConversation history (for context):\n${recentMessages}\n`;
    }

    // LLM validation with context awareness
    const prompt = `Act as a strict gatekeeper for a medical research platform.
Is the following query related to medical research, diseases, treatments, or clinical trials?
${contextHint}
Current query: "${userQuery}"

Rules:
- If it is a greeting, small talk, general knowledge (history, geography), non-medical technology, math, or physics AND there is no medical conversation context, return "NON_MEDICAL".
- If it is about a disease, symptom, medication, clinical trial, or medical study, return "MEDICAL".
- IMPORTANT: If the query is a follow-up to a previous medical conversation (e.g. "in india", "what about stage 3", "show me more"), it IS medical. Return "MEDICAL".

Output ONLY the word "MEDICAL" or "NON_MEDICAL". No explanation.`;

    try {
      const completion = await this.groq1.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 5,
        temperature: 0,
      });
      const res = completion.choices[0]?.message?.content?.trim().toUpperCase();
      console.log(`🛡️  GATEKEEPER: "${userQuery}" -> ${res} (history: ${conversationHistory.length} msgs)`);
      return res.includes('MEDICAL') && !res.includes('NON_') ? 'MEDICAL' : 'NON_MEDICAL';
    } catch (err) {
      console.warn('⚠️ Gatekeeper LLM error:', err.message);
      // If there's conversation context, assume it's a follow-up → MEDICAL
      if (conversationHistory.length > 0) return 'MEDICAL';
      return this._detectIntent(userQuery);
    }
  }

  _detectIntent(query, history = []) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return 'NON_MEDICAL';
    
    // Intent Classification Keywords
    const pubKeywords = ["paper", "research", "publication", "study", "journal", "evidence", "latest research", "literature"];
    const trialKeywords = ["clinical trial", "trial", "ongoing study", "experimental", "phase", "testing on humans", "new treatments being tested"];
    const medKeywords = ["treatment", "symptoms", "causes", "overview", "management", "risk factors", "diagnosis", "dosage"];

    const blacklist = ["string theory", "anti-de sitter", "de rham", "p-adic", "computational complexity", "double copy"];
    if (blacklist.some(k => q.includes(k))) return 'NON_MEDICAL';

    if (pubKeywords.some(k => q.includes(k))) return 'PUBLICATIONS';
    if (trialKeywords.some(k => q.includes(k))) return 'CLINICAL_TRIALS';
    if (medKeywords.some(k => q.includes(k))) return 'GENERAL_MEDICAL';

    return 'GENERAL_MEDICAL';
  }

  async generateStreamingResponse({ userQuery, publications, trials, context, history, queryInfo, res, intent: providedIntent }) {
    const intent = providedIntent || this._detectIntent(userQuery, history);

    if (intent === 'NON_MEDICAL') {
      const rejection = JSON.stringify({
        conditionOverview: "This system is designed for medical and research-related queries. Please ask about diseases, treatments, research, or clinical trials.",
        researchInsights: [],
        clinicalTrialsSummary: "",
        personalizedRecommendation: "",
        followUpSuggestions: ["Latest lung cancer research", "Clinical trials for diabetes", "Heart disease studies"]
      });
      res.write(`data: ${JSON.stringify({ token: rejection })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return rejection;
    }

    const contextBlock = this._contextBlock(context, history);

    // --- PROMPT 1: LITERATURE ENGINE ---
    const sysPrompt1 = `You are a Medical Research Insights Engine. Focus purely on literature and condition overviews. Base ALL claims ONLY on the provided research data. No prose outside JSON.
MANDATORY JSON SCHEMA:
{
  "conditionOverview": "string",
  "researchInsights": [
    { "finding": "string", "sourcePMID": "string", "confidence": "high|medium|low" }
  ],
  "personalizedRecommendation": "string"
}`;

    const msg1 = [
      { role: 'system', content: sysPrompt1 },
      { role: 'user', content: `${contextBlock}\n\nPUBLICATIONS DATA:\n${this._sourcesBlock(publications, [])}\n\nUSER QUERY:\n"${userQuery}"` }
    ];

    // --- PROMPT 2: CLINICAL STATUS ENGINE ---
    const sysPrompt2 = `You are a Clinical Trials Synthesizer. Focus purely on the clinical/experimental pipeline status. Base ALL claims ONLY on the provided trials data. No prose outside JSON.

STRICT RULE: followUpSuggestions MUST be related to scientific research, clinical trials, or medical publications only.
Examples of good follow-ups: "Latest treatment for lung cancer", "Clinical trials for diabetes", "Recent studies on Alzheimer's".

MANDATORY JSON SCHEMA:
{
  "clinicalTrialsSummary": "string",
  "followUpSuggestions": ["string", "string", "string"]
}`;

    const msg2 = [
      { role: 'system', content: sysPrompt2 },
      { role: 'user', content: `${contextBlock}\n\nCLINICAL TRIALS DATA:\n${this._sourcesBlock([], trials)}\n\nUSER QUERY:\n"${userQuery}"` }
    ];

    try {
      console.log('⚡ Firing Dual-LLM Map-Reduce Engine with Load Balancing...');
      // Execute Map-Reduce simultaneously using BOTH keys!
      const [res1, res2] = await Promise.all([
        this.groq1.chat.completions.create({
          model: this.model, messages: msg1, max_tokens: 1500, temperature: LLM_TEMPERATURE, response_format: { type: 'json_object' },
        }),
        this.groq2.chat.completions.create({
          model: this.model, messages: msg2, max_tokens: 1000, temperature: LLM_TEMPERATURE, response_format: { type: 'json_object' },
        })
      ]);

      const data1 = JSON.parse(res1.choices[0]?.message?.content || '{}');
      const data2 = JSON.parse(res2.choices[0]?.message?.content || '{}');

      // Merge payloads instantly
      const finalJson = { ...data1, ...data2 };
      const outputStr = JSON.stringify(finalJson);

      // Fire in one instant burst to the UI stream
      res.write(`data: ${JSON.stringify({ token: outputStr })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

      return outputStr;
    } catch (error) {
      console.error('❌ Dual LLM execution error:', error.message);
      const fallback = this._fallbackResponse(publications, trials, userQuery);
      res.write(`data: ${JSON.stringify({ token: fallback, done: true })}\n\n`);
      res.end();
      return fallback;
    }
  }

  _buildMessages({ userQuery, publications, trials, context, history, queryInfo, intent }) {
    const systemPrompt = this._systemPrompt(intent);
    const contextBlock = this._contextBlock(context, history);
    const sourcesBlock = this._sourcesBlock(publications, trials);
    const expandedStr = queryInfo ? queryInfo.primary : '';

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${contextBlock}\n\nDETECTED INTENT: ${intent}\n\n${sourcesBlock}\n\nMEDICAL SEARCH EXECUTED:\n"${expandedStr}"\n\nUSER'S ORIGINAL QUERY:\n"${userQuery}"` },
    ];
  }

  _systemPrompt(intent) {
    return `You are a medical research assistant. Base ALL claims only on the provided research data.
Never hallucinate. If data is insufficient, say so clearly.
Always cite the source title when making a claim.
Format response as valid JSON only, no markdown, no prose outside JSON.

MANDATORY JSON SCHEMA:
{
  "conditionOverview": "string",
  "researchInsights": [
    { "finding": "string", "sourcePMID": "string", "confidence": "high|medium|low" }
  ],
  "clinicalTrialsSummary": "string",
  "personalizedRecommendation": "string",
  "followUpSuggestions": ["string", "string", "string"]
}`;
  }

  _contextBlock(context, history) {
    let block = 'CONVERSATION CONTEXT:\n';
    if (context && context.contextState) {
      const c = context.contextState;
      if (c.disease) block += `* Disease: ${c.disease}\n`;
      if (c.stage) block += `* Stage: ${c.stage}\n`;
      if (c.mutation) block += `* Mutation: ${c.mutation}\n`;
    }
    if (history?.length > 0) {
      block += 'Conversation Summary (Last 5 exchanges):\n* ';
      // Truncate to keep the last 5 EXCHANGES (approx 5-10 messages) for token efficiency
      history.slice(-5).forEach(msg => {
        if (msg.role === 'user') block += `User: "${msg.content.substring(0, 150)}"\n* `;
        else if (msg.metadata?.aiSummary) block += `AI: "${msg.metadata.aiSummary.substring(0, 150)}"\n* `;
      });
    }
    return block;
  }

  _sourcesBlock(publications, trials) {
    let block = '';
    if (publications?.length > 0) {
      block += '\n=== PUBLICATIONS ===\n';
      publications.forEach((pub, i) => {
        block += `[P${i + 1}] "${pub.title}" | ${pub.abstract?.substring(0, 200)}\n`;
      });
    }
    if (trials?.length > 0) {
      block += '\n=== TRIALS ===\n';
      trials.forEach((trial, i) => {
        block += `[T${i + 1}] "${trial.title}" | Status: ${trial.status}\n`;
      });
    }
    return block;
  }

  _fallbackResponse(publications, trials) {
    return JSON.stringify({
      conditionOverview: 'Synthesis failed. Showing raw retrieval results.',
      researchInsights: [{ finding: 'Data available in sources below.', sourcePMID: '', confidence: 'low' }],
      clinicalTrialsSummary: 'Fallback text.',
      personalizedRecommendation: 'Please review raw findings.',
      followUpSuggestions: []
    });
  }

  async healthCheck() {
    return { available: !!process.env.GROQ_API_KEY, provider: 'Groq' };
  }
}

module.exports = LLMService;