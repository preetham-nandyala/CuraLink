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
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
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
      const completion = await this.groq.chat.completions.create({
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
      const completion = await this.groq.chat.completions.create({
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

  _detectIntent(query, history = []) {
    const q = query.toLowerCase();
    
    // Intent Classification Keywords
    const pubKeywords = ["paper", "research", "publication", "study", "journal", "evidence", "latest research", "literature"];
    const trialKeywords = ["clinical trial", "trial", "ongoing study", "experimental", "phase", "testing on humans", "new treatments being tested"];
    const medKeywords = ["treatment", "symptoms", "causes", "overview", "management", "risk factors", "diagnosis", "dosage"];

    // Non-medical heuristic
    const commonNonMed = ["hello", "hi", "how are you", "what's the weather", "who are you", "tell me a joke"];
    if (commonNonMed.some(k => q.startsWith(k)) && !q.includes("cancer") && !q.includes("disease")) return 'NON_MEDICAL';

    if (pubKeywords.some(k => q.includes(k))) return 'PUBLICATIONS';
    if (trialKeywords.some(k => q.includes(k))) return 'CLINICAL_TRIALS';
    if (medKeywords.some(k => q.includes(k))) return 'GENERAL_MEDICAL';

    return 'GENERAL_MEDICAL';
  }

  async generateStreamingResponse({ userQuery, publications, trials, context, history, queryInfo, res }) {
    const intent = this._detectIntent(userQuery, history);

    if (intent === 'NON_MEDICAL') {
      const rejection = JSON.stringify({
        token: JSON.stringify({
          condition_overview: "This system is designed for medical and research-related queries. Please ask about diseases, treatments, research, or clinical trials.",
          research_insights: [],
          treatment_direction: "",
          patient_summary: "",
          key_takeaway: "Non-medical query detected.",
          limitations: "",
          clinical_trials: [],
          publications: []
        }),
        done: true
      });
      res.write(`data: ${rejection}\n\n`);
      res.end();
      return;
    }

    const messages = this._buildMessages({ userQuery, publications, trials, context, history, queryInfo, intent });
    let fullResponse = '';

    try {
      const stream = await this.groq.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: LLM_MAX_TOKENS,
        temperature: LLM_TEMPERATURE,
        stream: true,
        response_format: { type: 'json_object' },
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        fullResponse += token;
        if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return fullResponse || this._fallbackResponse(publications, trials, userQuery);
    } catch (error) {
      console.error('❌ LLM streaming error:', error.message);
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