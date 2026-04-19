const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const Conversation = require('../models/Conversation');

const seedDemo = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/curalink');
    console.log('Connected to DB');

    // Create 2 dummy sessions
    const session1 = {
      messages: [{ role: 'user', content: 'What are the latest treatments for lung cancer?', timestamp: new Date() }],
      context: { diseases: ['lung cancer'], topics: ['treatments'], treatments: [] }
    };

    const session2 = {
      messages: [{ role: 'user', content: 'Are there any clinical trials for Alzheimer in New York?', timestamp: new Date() }],
      context: { diseases: ['Alzheimer'], topics: ['clinical trials'], treatments: [] }
    };

    await Conversation.insertMany([session1, session2]);
    console.log('✅ Demo seed data inserted correctly!');
    process.exit(0);
  } catch (e) {
    console.error('❌ Seeding failed', e);
    process.exit(1);
  }
};

seedDemo();
