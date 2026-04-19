const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

// Process natural language chat
router.post('/', protect, chatController.processChat);

// Process structured input
router.post('/structured', optionalAuth, chatController.processStructuredChat);

// Process structured input with Streaming SSE
router.post('/structured/stream', optionalAuth, chatController.processStructuredChatStream);

// Health check
router.get('/health', chatController.healthCheck);

module.exports = router;
