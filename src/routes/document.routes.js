const express = require("express");
const multer = require("multer");
const pdfParseModule = require("pdf-parse");
const { GoogleGenAI } = require("@google/genai");

const Document = require("../models/Document");
const Chunk = require("../models/Chunk");
const { splitTextIntoChunks } = require("../utils/ragUtils");
const { optionalAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.use(optionalAuth);

/**
 * Helper: extract raw text from PDF buffer supporting both pdf-parse v1 and v2
 */
async function extractTextFromPdf(buffer) {
  // If v1 function: pdfParse(buffer)
  if (typeof pdfParseModule === "function") {
    const data = await pdfParseModule(buffer);
    return data.text;
  }
  if (typeof pdfParseModule.default === "function") {
    const data = await pdfParseModule.default(buffer);
    return data.text;
  }
  // If v2 class: new PDFParse({ data: buffer })
  const PDFParseClass = pdfParseModule.PDFParse || pdfParseModule;
  if (typeof PDFParseClass === "function") {
    const parser = new PDFParseClass({ data: buffer });
    const result = await parser.getText();
    if (typeof parser.destroy === "function") {
      await parser.destroy();
    }
    return result.text;
  }
  throw new Error("Unsupported pdf-parse module format");
}

// ── Multer: store PDF in memory (no disk writes) ──────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"), false);
    }
  },
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Helper: generate a single embedding for a piece of text.
 */
async function embedText(text) {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });
  // SDK v2 may return result.embedding.values OR result.embeddings[0].values
  return (
    result?.embedding?.values ||
    result?.embeddings?.[0]?.values
  );
}

// ── POST /api/documents/upload  ───────────────────────────────────────────────
// Accepts: multipart/form-data  field name = "pdf"
router.post("/upload", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF file provided. Field name must be 'pdf'." });
  }

  // 1. Save document record (status = processing)
  const doc = await Document.create({
    userId: req.user ? req.user._id : null,
    name: req.file.originalname.replace(/\.pdf$/i, ""),
    originalName: req.file.originalname,
    size: req.file.size,
    status: "processing",
  });

  // Run the heavy work asynchronously so we can respond immediately
  (async () => {
    try {
      // 2. Parse PDF text
      const rawText = await extractTextFromPdf(req.file.buffer);

      if (!rawText || rawText.trim().length === 0) {
        await Document.findByIdAndUpdate(doc._id, { status: "failed" });
        return;
      }

      // 3. Chunk the text
      const chunks = splitTextIntoChunks(rawText, 800, 150);
      console.log(`📄 "${doc.originalName}" → ${chunks.length} chunks`);

      // 4. Embed each chunk and save to MongoDB
      const chunkDocs = [];
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await embedText(chunks[i]);
        chunkDocs.push({
          documentId: doc._id,
          documentName: doc.name,
          chunkIndex: i,
          content: chunks[i],
          embedding,
        });
        // Small delay to avoid rate-limiting on free tier
        await new Promise((r) => setTimeout(r, 100));
      }

      await Chunk.insertMany(chunkDocs);

      // 5. Mark document ready
      await Document.findByIdAndUpdate(doc._id, {
        status: "ready",
        totalChunks: chunks.length,
      });

      console.log(`✅ Document "${doc.originalName}" fully indexed.`);
    } catch (err) {
      console.error("❌ Indexing failed:", err.message);
      await Document.findByIdAndUpdate(doc._id, { status: "failed" });
    }
  })();

  // Respond immediately — indexing happens in background
  res.status(202).json({
    message: "PDF uploaded. Indexing started in background.",
    documentId: doc._id,
    documentName: doc.originalName,
  });
});

// ── GET /api/documents  ───────────────────────────────────────────────────────
// List all uploaded documents
router.get("/", async (req, res) => {
  try {
    const filter = req.user
      ? { $or: [{ userId: req.user._id }, { userId: null }] }
      : {};
    const docs = await Document.find(filter).sort({ createdAt: -1 }).select("-__v");
    res.json({ documents: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/documents/:id  ────────────────────────────────────────────────
// Remove a document and all its chunks
router.delete("/:id", async (req, res) => {
  try {
    await Chunk.deleteMany({ documentId: req.params.id });
    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: "Document and its chunks deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
