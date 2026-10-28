/**
 * RAG Utility Helpers
 * - splitTextIntoChunks: splits raw text into overlapping chunks
 * - cosineSimilarity: computes similarity between two vectors
 * - getTopKChunks: ranks stored chunks by similarity to a query embedding
 */

/**
 * Split a large text into smaller overlapping chunks.
 * @param {string} text
 * @param {number} chunkSize   - characters per chunk (default 800)
 * @param {number} chunkOverlap - overlap between adjacent chunks (default 150)
 * @returns {string[]}
 */
function splitTextIntoChunks(text, chunkSize = 800, chunkOverlap = 150) {
  const chunks = [];
  let start = 0;
  const cleanText = text.replace(/\s+/g, " ").trim();

  while (start < cleanText.length) {
    const end = Math.min(start + chunkSize, cleanText.length);
    const chunk = cleanText.slice(start, end).trim();
    if (chunk.length > 50) {
      // skip tiny trailing fragments
      chunks.push(chunk);
    }
    if (end === cleanText.length) break;
    start += chunkSize - chunkOverlap;
  }
  return chunks;
}

/**
 * Compute cosine similarity between two numeric vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Return the top-K most relevant chunks from an array of stored chunks
 * given a query embedding vector.
 * @param {number[]} queryEmbedding
 * @param {Array<{embedding: number[], content: string}>} allChunks
 * @param {number} topK
 * @returns {Array<{content: string, score: number}>}
 */
function getTopKChunks(queryEmbedding, allChunks, topK = 5) {
  const scored = allChunks.map((chunk) => ({
    content: chunk.content,
    documentName: chunk.documentName,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

module.exports = { splitTextIntoChunks, cosineSimilarity, getTopKChunks };
