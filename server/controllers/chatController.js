const Conversation = require('../models/Conversation');
const QueryExpander = require('../services/queryExpander');
const RetrievalOrchestrator = require('../services/retrieval/retrievalOrchestrator');
const Reranker = require('../services/reranker');
const LLMService = require('../services/llmService');
const ContextManager = require('../services/contextManager');

const queryExpander = new QueryExpander(); // No LLM dependencies for synonym map
const orchestrator = new RetrievalOrchestrator();
const reranker = new Reranker();
const llmService = new LLMService();
const contextManager = new ContextManager();

/**
 * Process a chat message (natural language)
 * POST /api/chat
 */
exports.processChat = async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const startTime = Date.now();

    // Load or create conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      conversation = new Conversation({
        user: req.user.id,
        messages: [],
        context: { diseases: [], topics: [], treatments: [] },
      });
    }

    // Analyze follow-up context
    const followUpAnalysis = contextManager.analyzeFollowUp(
      message,
      conversation.context
    );

    // Build input for query expansion
    const input = {
      content: message,
      disease: followUpAnalysis.contextDisease || '',
      query: message,
      location: conversation.userProfile?.location || '',
    };

    // Step 1: Detect intent early to save API calls
    const intent = await llmService.validateMedicalIntent(message);
    let publications = [], trials = [], rankedPublications = [], rankedTrials = [], retrievalMeta = { totalRetrieved: 0, retrievalTimeMs: 0 };
    let expandedQuery = null;

    if (intent !== 'NON_MEDICAL') {
      expandedQuery = await queryExpander.expand(input, conversation.context);
      console.log(`🔍 Expanded: "${expandedQuery.primary}"`);

      // Step 2: Retrieve from all sources
      const fetched = await orchestrator.retrieve(expandedQuery);
      publications = fetched.publications; trials = fetched.trials; retrievalMeta = fetched.metadata;

      // Step 3: Re-rank
      const ranked = await reranker.rank(publications, trials, expandedQuery);
      rankedPublications = ranked.rankedPublications; rankedTrials = ranked.rankedTrials;
    } else {
      console.log(`⚠️ NON_MEDICAL intent detected. Skipping external API fetches.`);
    }

    // Step 4: Generate LLM response
    const llmResponse = await llmService.generateResponse({
      userQuery: message,
      publications: rankedPublications,
      trials: rankedTrials,
      context: conversation.context,
      history: conversation.messages.slice(-6),
      queryInfo: expandedQuery,
    });

    // Step 5: Update context
    if (intent !== 'NON_MEDICAL' && expandedQuery) {
      conversation.context = contextManager.updateContext(
        conversation.context,
        expandedQuery,
        message
      );
    }

    // Step 6: Save messages
    // Add user message
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // Build sources for response
    const sources = [
      ...rankedPublications.map(pub => ({
        type: 'publication',
        title: pub.title,
        authors: pub.authors,
        year: pub.year,
        url: pub.url,
        snippet: pub.abstract ? pub.abstract.substring(0, 200) : '',
        abstract: pub.abstract || '',
        platform: pub.platform,
        citationCount: pub.citationCount || 0,
        journal: pub.journal || '',
      })),
      ...rankedTrials.map(trial => ({
        type: 'clinical_trial',
        title: trial.briefTitle || trial.title,
        status: trial.status,
        url: trial.url,
        eligibility: trial.eligibility ? trial.eligibility.substring(0, 300) : '',
        abstract: trial.abstract || '',
        location: trial.locations?.slice(0, 3).join('; ') || trial.location || '',
        contacts: trial.contacts || '',
        platform: trial.platform,
        phases: trial.phases || '',
        enrollmentCount: trial.enrollmentCount || 0,
      })),
    ];

    // Add assistant message
    conversation.messages.push({
      role: 'assistant',
      content: llmResponse,
      sources,
      metadata: {
        totalRetrieved: retrievalMeta.totalRetrieved,
        totalShown: rankedPublications.length + rankedTrials.length,
        retrievalTimeMs: retrievalMeta.retrievalTimeMs,
        expandedQuery: expandedQuery ? expandedQuery.expandedDescription : 'N/A',
      },
      timestamp: new Date(),
    });

    await conversation.save();

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Response generated in ${totalTime}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    res.json({
      conversationId: conversation._id,
      message: {
        role: 'assistant',
        content: llmResponse,
        sources,
        metadata: {
          totalRetrieved: retrievalMeta.totalRetrieved,
          totalShown: rankedPublications.length + rankedTrials.length,
          retrievalTimeMs: retrievalMeta.retrievalTimeMs,
          totalTimeMs: totalTime,
          expandedQuery: expandedQuery.expandedDescription,
          isFollowUp: followUpAnalysis.isFollowUp,
          sourceBreakdown: {
            openAlex: retrievalMeta.openAlexCount,
            pubmed: retrievalMeta.pubmedCount,
            clinicalTrials: retrievalMeta.trialsCount,
          },
        },
      },
    });
  } catch (error) {
    console.error('❌ Chat processing error:', error);
    res.status(500).json({ error: 'Failed to process your query. Please try again.' });
  }
};

/**
 * Process a structured input
 * POST /api/chat/structured
 */
exports.processStructuredChat = async (req, res) => {
  try {
    const { patientName, disease, query, location, conversationId } = req.body;

    if (!disease && !query) {
      return res.status(400).json({ error: 'Please provide a disease or query' });
    }

    const startTime = Date.now();

    // Create or load conversation
    let conversation;
    if (conversationId && req.user) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      conversation = {
        _id: req.user ? undefined : 'guest_convo', // dummy ID for non-logged in
        user: req.user ? req.user.id : undefined,
        userProfile: { name: patientName, diseaseOfInterest: disease, location },
        messages: [],
        context: { diseases: disease ? [disease] : [], topics: [], treatments: [] },
      };
      if (req.user) {
        conversation = new Conversation(conversation);
      }
    }

    // Update userProfile
    if (patientName) conversation.userProfile.name = patientName;
    if (disease) conversation.userProfile.diseaseOfInterest = disease;
    if (location) conversation.userProfile.location = location;

    // Build combined user message
    const userMessage = query
      ? `${query}${disease ? ` (Disease: ${disease})` : ''}${location ? ` (Location: ${location})` : ''}`
      : `Research about ${disease}${location ? ` in ${location}` : ''}`;

    // Build initial input context
    const input = { disease, query: query || disease, location, patientName };

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🗣️  Raw Input: Disease="${disease}", Query="${query}", Location="${location}"`);

    // 1. Noise Removal (LLM Filter)
    const cleanedQueryStr = await llmService.cleanQuery(input.query);
    console.log(`🧹 Cleaned Output: "${cleanedQueryStr}"`);
    input.query = cleanedQueryStr; // Swap in the clean query

    // 2. Query Expansion & Local Routing
    const expandedQuery = await queryExpander.expand(input, conversation.context);
    console.log(`🔍 Expanded: "${expandedQuery.primary}"`);

    // 3. Retrieval & Ranking
    const { publications, trials, metadata: retrievalMeta } = await orchestrator.retrieve(expandedQuery);
    const { rankedPublications, rankedTrials } = await reranker.rank(publications, trials, expandedQuery);

    const llmResponse = await llmService.generateResponse({
      userQuery: userMessage,
      publications: rankedPublications,
      trials: rankedTrials,
      context: conversation.context,
      history: conversation.messages.slice(-6),
      queryInfo: expandedQuery,
    });

    // Update context
    conversation.context = contextManager.updateContext(
      conversation.context, expandedQuery, userMessage
    );

    // Build sources
    const sources = [
      ...rankedPublications.map(pub => ({
        type: 'publication',
        title: pub.title,
        authors: pub.authors,
        year: pub.year,
        url: pub.url,
        snippet: pub.abstract ? pub.abstract.substring(0, 200) : '',
        abstract: pub.abstract || '',
        platform: pub.platform,
        citationCount: pub.citationCount || 0,
        journal: pub.journal || '',
      })),
      ...rankedTrials.map(trial => ({
        type: 'clinical_trial',
        title: trial.briefTitle || trial.title,
        status: trial.status,
        url: trial.url,
        eligibility: trial.eligibility ? trial.eligibility.substring(0, 300) : '',
        abstract: trial.abstract || '',
        location: trial.locations?.slice(0, 3).join('; ') || trial.location || '',
        contacts: trial.contacts || '',
        platform: trial.platform,
        phases: trial.phases || '',
        enrollmentCount: trial.enrollmentCount || 0,
      })),
    ];

    // Save messages
    conversation.messages.push({
      role: 'user',
      content: userMessage,
      structuredInput: { patientName, disease, query, location },
      timestamp: new Date(),
    });

    // 4. Context Summarization Layer (0 latency)
    // Extract key_takeaway to use as AI summary for follow-up turns
    let aiSummary = 'Patient discussing ' + (disease || 'medical condition');
    try {
      const parsed = JSON.parse(llmResponse);
      if (parsed.key_takeaway) aiSummary = parsed.key_takeaway;
      else if (parsed.condition_overview) aiSummary = parsed.condition_overview.substring(0, 100) + '...';
    } catch (e) {
      console.log('JSON parse failed for summary extraction in structured chat');
    }

    conversation.messages.push({
      role: 'assistant',
      content: llmResponse,
      sources,
      metadata: {
        totalRetrieved: retrievalMeta.totalRetrieved,
        totalShown: rankedPublications.length + rankedTrials.length,
        retrievalTimeMs: retrievalMeta.retrievalTimeMs,
        expandedQuery: expandedQuery.expandedDescription,
        aiSummary: aiSummary,
      },
      timestamp: new Date(),
    });

    // Auto-generate title from first message if not set
    if (!conversation.title || conversation.title === 'New Conversation') {
      const titleBase = disease || query || userMessage;
      conversation.title = titleBase.length > 50 ? titleBase.substring(0, 50) + '…' : titleBase;
    }

    if (req.user && typeof conversation.save === 'function') {
      await conversation.save();
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Response generated in ${totalTime}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    res.json({
      conversationId: req.user ? conversation._id : null,
      message: {
        role: 'assistant',
        content: llmResponse,
        sources,
        metadata: {
          totalRetrieved: retrievalMeta.totalRetrieved,
          totalShown: rankedPublications.length + rankedTrials.length,
          retrievalTimeMs: retrievalMeta.retrievalTimeMs,
          totalTimeMs: totalTime,
          expandedQuery: expandedQuery.expandedDescription,
          sourceBreakdown: {
            openAlex: retrievalMeta.openAlexCount,
            pubmed: retrievalMeta.pubmedCount,
            clinicalTrials: retrievalMeta.trialsCount,
          },
        },
      },
    });
  } catch (error) {
    console.error('❌ Structured chat error:', error);
    res.status(500).json({ error: 'Failed to process your query. Please try again.' });
  }
};

/**
 * Process a structured input STREAM
 * POST /api/chat/structured/stream
 */
exports.processStructuredChatStream = async (req, res) => {
  try {
    const { patientName, disease, query, location, conversationId } = req.body;

    if (!disease && !query) {
      return res.status(400).json({ error: 'Please provide a disease or query' });
    }

    const startTime = Date.now();

    let conversation;
    if (conversationId && req.user) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      conversation = {
        _id: req.user ? undefined : 'guest_convo',
        user: req.user ? req.user.id : undefined,
        userProfile: { name: patientName, diseaseOfInterest: disease, location },
        messages: [],
        context: { diseases: disease ? [disease] : [], topics: [], treatments: [] },
      };
      if (req.user) {
        conversation = new Conversation(conversation);
      }
    }

    if (patientName) conversation.userProfile.name = patientName;
    if (disease) conversation.userProfile.diseaseOfInterest = disease;
    if (location) conversation.userProfile.location = location;

    const userMessage = query
      ? `${query}${disease ? ` (Disease: ${disease})` : ''}${location ? ` (Location: ${location})` : ''}`
      : `Research about ${disease}${location ? ` in ${location}` : ''}`;

    const input = { disease, query: query || disease, location, patientName };

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🗣️  Structured Input STREAM: Disease="${disease}", Query="${query}", Location="${location}"`);

    // FIX: Detect intent on the RAW query/content, not the formatted userMessage which contains context labels
    const intent = await llmService.validateMedicalIntent(query || disease || '');
    let publications = [], trials = [], rankedPublications = [], rankedTrials = [], retrievalMeta = { totalRetrieved: 0, retrievalTimeMs: 0 };
    let expandedQuery = null;

    if (intent !== 'NON_MEDICAL') {
      expandedQuery = await queryExpander.expand(input, conversation.context);
      console.log(`🔍 Expanded: "${expandedQuery.primary}"`);

      const fetched = await orchestrator.retrieve(expandedQuery);
      publications = fetched.publications; trials = fetched.trials; retrievalMeta = fetched.metadata;
      
      const ranked = await reranker.rank(publications, trials, expandedQuery);
      rankedPublications = ranked.rankedPublications; rankedTrials = ranked.rankedTrials;

      conversation.context = contextManager.updateContext(
        conversation.context, expandedQuery, userMessage
      );
    } else {
      console.log(`⚠️ NON_MEDICAL intent detected. Skipping external API fetches.`);
    }

    const sources = [
      ...rankedPublications.map(pub => ({
        type: 'publication', title: pub.title, authors: pub.authors, year: pub.year, url: pub.url,
        snippet: pub.abstract ? pub.abstract.substring(0, 200) : '', abstract: pub.abstract || '', platform: pub.platform,
        citationCount: pub.citationCount || 0, journal: pub.journal || '',
      })),
      ...rankedTrials.map(trial => ({
        type: 'clinical_trial', title: trial.briefTitle || trial.title, status: trial.status, url: trial.url,
        eligibility: trial.eligibility ? trial.eligibility.substring(0, 300) : '', abstract: trial.abstract || '',
        location: trial.locations?.slice(0, 3).join('; ') || trial.location || '',
        contacts: trial.contacts || '', platform: trial.platform, phases: trial.phases || '', enrollmentCount: trial.enrollmentCount || 0,
      })),
    ];

    conversation.messages.push({
      role: 'user', content: userMessage, structuredInput: { patientName, disease, query, location }, timestamp: new Date(),
    });

    // Start Stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders();
    
    // Pass back conversationId if newly created and user is logged in, so frontend can save it
    // Using stringify with newline boundary
    res.write(`data: ${JSON.stringify({ sources, conversationId: req.user ? conversation._id : null })}\n\n`);

    const llmResponse = await llmService.generateStreamingResponse({
      userQuery: userMessage,
      publications: rankedPublications,
      trials: rankedTrials,
      context: conversation.context,
      history: conversation.messages.slice(-6),
      queryInfo: expandedQuery,
      res,
      intent // Pass the gated intent
    });

    // 4. Context Summarization Layer (0 latency)
    // Extract key_takeaway to use as AI summary for follow-up turns
    let aiSummary = 'Patient discussing ' + (disease || 'medical condition');
    try {
      const parsed = JSON.parse(llmResponse);
      if (parsed.conditionOverview) aiSummary = parsed.conditionOverview.substring(0, 100) + '...';
    } catch (e) {
      console.log('JSON parse failed for summary extraction (likely stream interrupt)');
    }

    // Save final AI chunk to DB
    conversation.messages.push({
      role: 'assistant',
      content: llmResponse,
      sources,
      metadata: {
        totalRetrieved: retrievalMeta.totalRetrieved,
        totalShown: rankedPublications.length + rankedTrials.length,
        retrievalTimeMs: retrievalMeta.retrievalTimeMs,
        expandedQuery: expandedQuery ? expandedQuery.expandedDescription : 'N/A',
        aiSummary: aiSummary,
      },
      timestamp: new Date(),
    });
    if (req.user && typeof conversation.save === 'function') {
      await conversation.save();
    }

    console.log(`\n✅ Streamed response generated entirely in ${Date.now() - startTime}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Structured chat STREAMing error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process your query. Please try again.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream interrupted due to server error' })}\n\n`);
      res.end();
    }
  }
};

/**
 * Health check for LLM
 * GET /api/chat/health
 */
exports.healthCheck = async (req, res) => {
  const llmHealth = await llmService.healthCheck();
  res.json({
    status: 'ok',
    llm: llmHealth,
    timestamp: new Date().toISOString(),
  });
};
