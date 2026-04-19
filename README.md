# 🏥 Curalink — AI Medical Research Assistant

> AI-powered medical research companion built with MERN stack + Ollama LLM

![Curalink](https://img.shields.io/badge/Curalink-v1.0-cyan) ![MERN](https://img.shields.io/badge/MERN-Stack-green) ![Ollama](https://img.shields.io/badge/LLM-Ollama%20Mistral-purple)

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **MongoDB** (local or Atlas)
- **Ollama** (for local LLM)

### 1. Install Ollama (Windows)
```powershell
# Download from https://ollama.com/download/windows
# After installing, pull the model:
ollama pull mistral
```

### 2. Start MongoDB
```bash
mongod
```

### 3. Start the Server
```bash
cd server
npm install
npm start
```

### 4. Start the Client
```bash
cd client
npm install
npm run dev
```

### 5. Open
Navigate to `http://localhost:5173`

## 🏗️ Architecture

```
User Query → Query Expansion (LLM) → Parallel Retrieval → Re-Ranking → LLM Reasoning → Response
                                          ├── OpenAlex (Publications)
                                          ├── PubMed (Publications)
                                          └── ClinicalTrials.gov (Trials)
```

### Pipeline Details
1. **Query Expansion**: LLM-powered synonym generation + context-aware expansion
2. **Parallel Retrieval**: 200-300 candidates from 3 sources simultaneously
3. **Multi-Factor Re-Ranking**: Relevance (40%) + Recency (25%) + Credibility (15%) + Quality (10%) + Location (10%)
4. **LLM Reasoning**: Structured, citation-grounded responses via Ollama Mistral
5. **Context Management**: Multi-turn follow-up intelligence

## 📂 Tech Stack
- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express  
- **Database**: MongoDB
- **LLM**: Ollama (Mistral 7B)
- **APIs**: OpenAlex, PubMed, ClinicalTrials.gov

## 📝 License
MIT
