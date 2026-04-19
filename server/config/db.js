const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is undefined. Please set it in .env');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
