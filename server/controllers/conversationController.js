const Conversation = require('../models/Conversation');

/**
 * Get all conversations (list view)
 * GET /api/conversations
 */
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ user: req.user.id })
      .select('title userProfile context createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

/**
 * Get a single conversation with full messages
 * GET /api/conversations/:id
 */
exports.getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user.id });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
};

/**
 * Create a new conversation
 * POST /api/conversations
 */
exports.createConversation = async (req, res) => {
  try {
    const { title, userProfile } = req.body;
    const conversation = new Conversation({
      user: req.user.id,
      title: title || 'New Conversation',
      userProfile: userProfile || {},
      messages: [],
      context: { diseases: [], topics: [], treatments: [] },
    });
    await conversation.save();
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
};

/**
 * Delete a conversation
 * DELETE /api/conversations/:id
 */
exports.deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
};

/**
 * Update conversation title
 * PATCH /api/conversations/:id
 */
exports.updateConversation = async (req, res) => {
  try {
    const { title } = req.body;
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { title },
      { new: true }
    );
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
};
