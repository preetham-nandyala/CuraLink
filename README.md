# Curalink AI Medical Research Assistant

## Overview
Curalink is a production-grade AI-powered medical research assistant. It integrates live API streams across PubMed, ClinicalTrials.gov, and OpenAlex, filtering data through an advanced dual-LLM MERN stack pipeline with custom dynamic ranking heuristics.

## Tech Stack
- MongoDB / Express.js / React / Node.js
- Tailwind CSS
- Open Source LLMs (Groq LLaMA 3.3 70B)
- fast-xml-parser / Lucide React

## Setup Instructions

1. **Clone the repository.**
2. **Install all dependencies:**
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

3. **Environment Setup:**
   Duplicate the `.env.example` inside the `server/` root to `.env` and configure keys.

4. **Run the Database Seed (Optional but recommended):**
   ```bash
   cd server
   node scripts/seedDemo.js
   ```

5. **Start Application:**
   Run from the project root or spin up concurrently:
   ```bash
   # Terminal 1 - Backend
   cd server && npm run dev
   # Terminal 2 - Frontend
   cd client && npm start
   ```

6. **Usage:**
   Navigate to the client URL on `localhost:3000` (or Vite proxy mapped). Create an account, login, and explore!
