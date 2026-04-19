const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many requests. Please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = apiLimiter;
