require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const chatRoutes = require('./routes/chatRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const authRoutes = require('./routes/authRoutes');

// Import EmbeddingService specifically to warm it up on startup
const embeddingService = require('./services/embeddingService');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

const mongoSanitize = require('express-mongo-sanitize');

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(mongoSanitize());
app.use('/api/', rateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);

// Root health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`\n🏥 Curalink API Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   LLM Check: http://localhost:${PORT}/api/chat/health\n`);
  
  // Warmup local embedding model asynchronously
  await embeddingService.warmup();
});

module.exports = app;
