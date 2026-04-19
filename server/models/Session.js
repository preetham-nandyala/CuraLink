const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true }, // MISSING FIX: sessionId unique index
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  data: { type: Object }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
