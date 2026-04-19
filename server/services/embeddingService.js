const { pipeline, env } = require('@xenova/transformers');

// Disable local model check — always download from HuggingFace Hub on first run
env.allowLocalModels = false;

/**
 * Embedding Service
 * Uses @xenova/transformers (all-MiniLM-L6-v2) to generate 384-dim embeddings
 * entirely inside the Node.js process — $0, no external API calls.
 *
 * The model (~23MB) is downloaded and cached on first invocation.
 * Subsequent calls use the cached model (<5ms warm start).
 */
class EmbeddingService {
  constructor() {
    this._pipeline = null;
    this._loading = null;
  }

  /**
   * Lazy-load the embedding pipeline (singleton).
   * Uses a lock (_loading promise) to prevent duplicate downloads
   * when multiple requests arrive during cold start.
   */
  async _getEmbedder() {
    if (this._pipeline) return this._pipeline;

    if (this._loading) return this._loading;

    this._loading = (async () => {
      console.log('🧠 Loading embedding model (all-MiniLM-L6-v2)...');
      const start = Date.now();
      this._pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log(`✅ Embedding model loaded in ${Date.now() - start}ms`);
      return this._pipeline;
    })();

    return this._loading;
  }

  /**
   * Generate an embedding vector for a single text string.
   * @param {string} text - Input text
   * @returns {Float32Array} 384-dimensional embedding vector
   */
  async embed(text) {
    const embedder = await this._getEmbedder();
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return output.data;
  }

  /**
   * Generate embeddings for multiple texts in batch.
   * @param {string[]} texts - Array of input texts
   * @returns {Float32Array[]} Array of 384-dim embedding vectors
   */
  async embedBatch(texts) {
    const embedder = await this._getEmbedder();
    const results = [];

    // Process in mini-batches of 8 to balance throughput vs memory
    const BATCH_SIZE = 8;
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (text) => {
        const output = await embedder(text, { pooling: 'mean', normalize: true });
        return output.data;
      });
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two embedding vectors.
   * Since vectors are L2-normalized by the pipeline, cosine similarity = dot product.
   * @param {Float32Array} a - First embedding
   * @param {Float32Array} b - Second embedding  
   * @returns {number} Similarity score in [-1, 1]
   */
  cosineSimilarity(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  /**
   * Pre-warm the model (call during server startup).
   * Avoids cold-start latency on the first user request.
   */
  async warmup() {
    try {
      await this.embed('warmup');
      console.log('🔥 Embedding model warmed up');
    } catch (err) {
      console.warn('⚠️  Embedding warmup failed:', err.message);
    }
  }
}

// Singleton export — shared across all services
module.exports = new EmbeddingService();
