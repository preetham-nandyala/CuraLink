const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  type: { type: String, enum: ['publication', 'clinical_trial'], required: true },
  title: { type: String, required: true },
  authors: [String],
  year: Number,
  url: String,
  snippet: String,
  platform: String,
  // Clinical trial specific
  status: String,
  eligibility: String,
  location: String,
  contacts: String,
}, { _id: false });

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  structuredInput: {
    patientName: String,
    disease: String,
    query: String,
    location: String,
  },
  sources: [sourceSchema],
  metadata: {
    totalRetrieved: Number,
    totalShown: Number,
    retrievalTimeMs: Number,
    expandedQuery: String,
    aiSummary: String,
  },
  timestamp: { type: Date, default: Date.now },
});

const conversationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: { type: String, default: 'New Conversation' },
  userProfile: {
    name: String,
    diseaseOfInterest: String,
    location: String,
  },
  messages: [messageSchema],
  context: {
    diseases: [String],
    topics: [String],
    treatments: [String],
    lastQuery: String,
    lastDisease: String,
  },
}, {
  timestamps: true,
});

// Auto-generate title from first user message
conversationSchema.pre('save', function () {
  if (this.isNew && this.messages.length > 0) {
    const firstMsg = this.messages[0].content;
    this.title = firstMsg.length > 60 ? firstMsg.substring(0, 57) + '...' : firstMsg;
  }
});

module.exports = mongoose.model('Conversation', conversationSchema);
