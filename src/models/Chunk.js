const mongoose = require("mongoose");

// Each chunk of a PDF document with its embedding vector
const chunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    documentName: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    // Gemini embedding vector (768-dim for text-embedding-004)
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chunk", chunkSchema);
