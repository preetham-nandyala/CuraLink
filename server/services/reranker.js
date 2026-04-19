/**
 * Re-Ranking Pipeline v3 — Keyword + Recency + Citations
 */
class Reranker {
  async rank(publications, trials, query) {
    if (!publications.length && !trials.length) return { rankedPublications: [], rankedTrials: [] };
    console.log(`\\n🏆 Re-ranking ${publications.length} publications and ${trials.length} trials...`);
    const startTime = Date.now();

    // Max citations for normalization
    const maxCitationsPub = Math.max(...publications.map(p => p.citationCount || 0), 1);
    const maxCitationsTrial = Math.max(...trials.map(t => t.citationCount || 0), 1); // Trials rarely have citations but safely checking

    // Keywords from query
    const keywords = `${query.primary} ${query.disease || ''}`
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);

    const scoreItem = (item, maxCitations) => {
      const titleAbs = (`${item.title || ''} ${item.abstract || ''}`).toLowerCase();
      
      // relevance: keyword match count in title+abstract, normalized 0-1
      let kwMatchCount = 0;
      keywords.forEach(kw => {
        if (titleAbs.includes(kw)) kwMatchCount++;
      });
      const relevance = keywords.length > 0 ? (kwMatchCount / keywords.length) : 0;
      const normalizedRelevance = Math.min(1.0, relevance);

      // recency: 2024→1.0, 2023→0.8, 2022→0.6, 2021→0.4, older→0.2
      let recency = 0.2;
      const yr = item.year || 0;
      if (yr >= 2024) recency = 1.0;
      else if (yr === 2023) recency = 0.8;
      else if (yr === 2022) recency = 0.6;
      else if (yr === 2021) recency = 0.4;

      // citations: cited_by_count normalized against max in result set
      const citations = (item.citationCount || 0) / maxCitations;

      // score = (relevance * 0.5) + (recency * 0.3) + (citations * 0.2)
      const score = (normalizedRelevance * 0.5) + (recency * 0.3) + (citations * 0.2);
      
      return { ...item, score };
    };

    const scoredPubs = publications.map(p => scoreItem(p, maxCitationsPub));
    const scoredTrials = trials.map(t => scoreItem(t, maxCitationsTrial));

    // Deduplicate publications by title
    const uniquePubs = [];
    const seenTitles = new Set();
    scoredPubs.sort((a, b) => b.score - a.score).forEach(pub => {
      const t = (pub.title || '').toLowerCase().substring(0, 30);
      if (!seenTitles.has(t)) {
        seenTitles.add(t);
        uniquePubs.push(pub);
      }
    });

    scoredTrials.sort((a, b) => b.score - a.score);

    // Truncate abstracts to protect LLM limits
    const rankedPubs = uniquePubs.slice(0, 6).map(pub => {
      if (pub.abstract && pub.abstract.length > 700) {
        return { ...pub, abstract: pub.abstract.substring(0, 700) + '...' };
      }
      return pub;
    });

    const rankedTrials = scoredTrials.slice(0, 5).map(trial => {
      if (trial.abstract && trial.abstract.length > 700) {
        return { ...trial, abstract: trial.abstract.substring(0, 700) + '...' };
      }
      return trial;
    });

    console.log(`   ✅ Re-ranked in ${Date.now() - startTime}ms`);
    return { rankedPublications: rankedPubs, rankedTrials };
  }
}

module.exports = new Reranker();