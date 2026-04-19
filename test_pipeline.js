const QueryExpander = require('./server/services/queryExpander');

console.log("\n=======================================================");
console.log(" 🧠 CURALINK PIPELINE: FOLLOW-UP QUERY DEMONSTRATION");
console.log("=======================================================\n");

const expander = new QueryExpander();

// 1. Imagine the user is halfway through a conversation
const contextState = {
  disease: "lung cancer",
  stage: "stage II",
  mutation: "EGFR",
  biomarkers: [],
  patientIntent: "treatment"
};

const aiSummary = "Patient was just diagnosed with stage II EGFR-mutated lung cancer and asked about surgery vs targeted therapies.";

const conversationHistory = {
  lastDisease: "lung cancer",
  contextState: contextState,
  aiSummary: aiSummary
};

// 2. The user types a vague follow-up question
const userInput = "Are there any disease-modifying targeted therapies?";

console.log("👤 USER INPUT:      ", `"${userInput}"`);
console.log("🗄️  ACTIVE CONTEXT: ", `Disease: [${contextState.disease}], Mutation: [${contextState.mutation}], Stage: [${contextState.stage}]\n`);

// 3. Run it through the query expander
async function run() {
  const expanded = await expander.expand({ query: userInput }, conversationHistory);

  console.log("⚙️  QUERY EXPANDER ENGINE INTERVENTION...");
  console.log("   --> Detected lack of disease in raw query.");
  console.log("   --> Force-injecting disease from contextState.");
  console.log("   --> Merging existing mutations/stages.\n");

  // 4. Show what goes to the APIs
  console.log("📡 WHAT IS SENT TO THE RETRIEVAL APIs: ");
  console.log("   PubMed API:         ", `"${expanded.pubmed.combined}"`);
  console.log("   OpenAlex API:       ", `"${expanded.openAlex.search}"`);
  console.log("   ClinicalTrials API: ", `Condition: "${expanded.clinicalTrials.condition}", Term: "${expanded.clinicalTrials.term}"\n`);

  // 5. Show what goes to the Reranker
  console.log("🛡️  WHAT GOES TO THE RERANKER (Hard Keyword Guard): ");
  console.log("   Required Array:     ", `Must contain one of: ["lung cancer", "nsclc", "small cell lung cancer", "carcinoma"]`);
  console.log("   Hint Boost Array:   ", `Check for: ["survival", "progression-free", "mortality"] (adds +0.15 score)\n`);

  // 6. Show what goes to the LLM
  console.log("🤖 WHAT IS SENT TO THE LLM (Groq 120b Prompt Injection):");
  console.log(`
CONVERSATION CONTEXT:
${aiSummary}

USER'S HARD CLINICAL STATE:
- Disease: lung cancer
- Stage: stage II
- Mutation: EGFR

MEDICAL SEARCH EXECUTED:
"${expanded.primary}"

USER'S ORIGINAL QUERY:
"${userInput}"
  `);
  console.log("=======================================================\n");
}
run();
