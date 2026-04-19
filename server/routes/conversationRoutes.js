const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { protect } = require('../middleware/authMiddleware');

// List all conversations
router.get('/', protect, conversationController.getConversations);

// Get single conversation
router.get('/:id', protect, conversationController.getConversation);

// Create new conversation
router.post('/', protect, conversationController.createConversation);

// Update conversation title
router.patch('/:id', protect, conversationController.updateConversation);

// Delete conversation
router.delete('/:id', protect, conversationController.deleteConversation);

module.exports = router;
