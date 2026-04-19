const mongoose = require('mongoose');

const cachedResultSchema = new mongoose.Schema({
  queryKey: { type: String, required: true, unique: true },
  results: { type: Object },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // MISSING FIX: TTL expireAfterSeconds 86400
});

module.exports = mongoose.model('CachedResult', cachedResultSchema);
