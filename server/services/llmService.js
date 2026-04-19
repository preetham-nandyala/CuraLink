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
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
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
    let focusRules = '';
    
    if (intent === 'PUBLICATIONS') {
      focusRules = `
### INTENT FOCUS: PUBLICATIONS (RESEARCH DASHBOARD MODE)
- PRIMARY GOAL: Provide a deep literature review (80% weight).
- PUBLICATIONS SECTION: Include 5-8 high-quality papers. Prioritize key findings.
- CLINICAL TRIALS: Include ONLY if highly relevant (max 1-2).
- OVERVIEW: Minimal medical overview (max 2 lines). Focus on research progress.`;
    } else if (intent === 'CLINICAL_TRIALS') {
      focusRules = `
### INTENT FOCUS: CLINICAL TRIALS (EXPERIMENTAL DASHBOARD MODE)
- PRIMARY GOAL: Highlight ongoing human studies (80% weight).
- CLINICAL TRIALS SECTION: Include 5-8 trials. Focus on interventions and recruitment status.
- PUBLICATIONS: Supporting evidence only.
- OVERVIEW: Focus exclusively on the experimental landscape.`;
    } else {
      focusRules = `
### INTENT FOCUS: GENERAL MEDICAL (BALANCED CARE MODE)
- PRIMARY GOAL: Provide a comprehensive management overview.
- BALANCE: Even weighting between Overview, Insights, Publications, and Trials.`;
    }

    return `You are an AI-powered Medical Research Assistant.
${focusRules}

STRICT RESPONSE RULES:
- Read, synthesize, and explain. DO NOT list raw source data.
- PRIORITY: Relevance > Quantity.
- Use signal phrases: "Strong clinical evidence shows...", "Moderate evidence suggests...", "Emerging evidence indicates...", "Early-stage research explores...".

MANDATORY JSON SCHEMA:
{
  "condition_overview": "Specific answer for ${intent}. Start with 'The most important treatments today are: '.",
  "research_insights": ["Most impactful shift: ...", "Standard insight...", "Emerging insight...", "Experimental insight..."],
  "key_takeaway": "Final 1-2 decisive sentences on the ${intent} landscape."
}

CRITICAL CONSTRAINTS:
1. SGLT2: For heart/diabetes/kidney, MUST mention SGLT2 inhibitors.
2. OVERVIEW: MUST begin with "The most important treatments today are:".
3. ORDER: Standard-of-care BEFORE experimental in insights.
4. CORE FACTORS: Always present the most common and clinically dominant factors first.`;
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
      block += 'Conversation Summary:\n* ';
      history.slice(-6).forEach(msg => {
        if (msg.role === 'user') block += `User: "${msg.content.substring(0, 100)}"\n* `;
        else if (msg.metadata?.aiSummary) block += `AI: "${msg.metadata.aiSummary.substring(0, 100)}"\n* `;
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
      condition_overview: 'Synthesis failed. Showing raw retrieval results.',
      research_insights: ['Data available in sources below.'],
      publications: (publications || []).slice(0, 3),
      clinical_trials: (trials || []).slice(0, 3)
    });
  }

  async healthCheck() {
    return { available: !!process.env.GROQ_API_KEY, provider: 'Groq' };
  }
}

module.exports = LLMService;