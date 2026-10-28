const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const Chunk = require("../models/Chunk");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { getTopKChunks } = require("../utils/ragUtils");
const { getAvailableMCPTools, callMCPTool } = require("../utils/mcpClient");
const { optionalAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.use(optionalAuth);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Models with active free-tier quota (avoiding gemini-2.5-flash which is capped at 20 req/day)
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-2.5-flash-lite",
];

async function generateWithFallback(prompt) {
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      return { text: result.text, modelUsed: model };
    } catch (err) {
      console.warn(`⚠️ Model "${model}" failed (${err.message}). Trying fallback model...`);
      lastError = err;
    }
  }
  throw lastError;
}

async function streamWithFallback(prompt) {
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents: prompt,
      });
      return { stream, modelUsed: model };
    } catch (err) {
      console.warn(`⚠️ Streaming model "${model}" failed (${err.message}). Trying fallback model...`);
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Helper to build the augmented prompt combining RAG context, multi-turn history, and user question.
 */
function buildPrompt({ context, historyText, question }) {
  return `You are SAT AI, an intelligent, helpful, and friendly AI assistant.

CRITICAL IDENTITY RULES:
- Your name is SAT AI.
- If asked "who are you?", "what is your name?", or similar identity questions, ALWAYS introduce yourself as SAT AI.
- NEVER say "I am a large language model, trained by Google" or "As an AI language model, I don't have feelings...".
- Respond naturally, warmly, and politely to greetings (for example, if asked "how are you", answer warmly like: "I'm doing great, thank you! Ready to assist you. How can I help you today?").

${context ? `CONTEXT FROM DOCUMENTS:\n${context}\n` : "NOTE: No specific documents provided. Answer using your comprehensive knowledge base as SAT AI.\n"}
${historyText ? `RECENT CONVERSATION HISTORY:\n${historyText}\n` : ""}
USER REQUEST:
${question}

INSTRUCTIONS:
1. Intent & Flow:
   - Maintain conversational context from previous messages if relevant.
   - Interpret casual queries or typos gracefully (e.g., "give me qutions list" means generate relevant interview or study questions; "skiles" means skills).
2. Question Generation & Analysis:
   - If the user asks for a "questions list", "interview questions", "summary", or "quiz", generate tailored, sharp questions derived directly from the projects, skills, and background in the context. Group them logically (e.g., Technical, Project Architecture, Experience).
3. Direct & Grounded:
   - For factual queries about uploaded documents, strictly rely on the provided context. If a fact is missing, state it honestly.
   - For general queries where no documents are referenced, provide high-quality, helpful general assistance as SAT AI.
4. Clean Formatting & Deduplication:
   - Use clean Markdown with bold headers and bullet points.
   - Deduplicate OCR artifacts (e.g., convert "Python (python, Python3)" to "Python", "React.js (React js)" to "React.js").
5. Natural Tone:
   - Avoid robotic openings like "Based on the provided context..." or "According to the documents...". Answer directly as SAT AI.

ANSWER:`;
}

/**
 * Helper to retrieve top chunks and format context
 */
async function retrieveRAGContext(question, documentId, topK = 5) {
  // If query is a simple greeting or identity question, don't force document retrieval
  const isGreeting = /^(hi|hello|hey|hola|greetings|how are you|who are you|what is your name|what's your name|tell me about yourself|good (morning|afternoon|evening))\b/i.test(question.trim());
  if (isGreeting) {
    return { context: "", topChunks: [] };
  }

  try {
    const embResult = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: question,
    });
    const queryEmbedding =
      embResult?.embedding?.values || embResult?.embeddings?.[0]?.values;

    if (!queryEmbedding) return { context: "", topChunks: [] };

    const filter = documentId ? { documentId } : {};
    const allChunks = await Chunk.find(filter).select("content documentName embedding");

    if (!allChunks || allChunks.length === 0) {
      return { context: "", topChunks: [] };
    }

    const topChunks = getTopKChunks(queryEmbedding, allChunks, topK);
    const relevantChunks = topChunks.filter((c) => c.score >= 0.40);
    const selectedChunks = relevantChunks.length > 0 ? relevantChunks : topChunks.slice(0, 2);

    const context = selectedChunks
      .map((c, i) => `[Source ${i + 1} - ${c.documentName}]\n${c.content}`)
      .join("\n\n---\n\n");

    return { context, topChunks: selectedChunks };
  } catch (err) {
    console.warn("⚠️ RAG retrieval warning:", err.message);
    return { context: "", topChunks: [] };
  }
}

/**
 * Helper: fetch recent history and format as text
 */
async function getRecentHistory(conversationId, limit = 8) {
  if (!conversationId) return { historyText: "", rawHistory: [] };

  const pastMessages = await Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const rawHistory = pastMessages.reverse();
  const historyText = rawHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  return { historyText, rawHistory };
}

// ── POST /api/chat (Standard Response + Multi-Turn + Token Tracking) ─────────
router.post("/", async (req, res) => {
  try {
    const { question, documentId, conversationId, topK = 5, stream = false } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Please provide a non-empty 'question' field." });
    }

    // Check user token quota
    if (req.user && req.user.totalTokensUsed >= req.user.tokenLimit) {
      return res.status(429).json({
        error: `Token quota exceeded (${req.user.totalTokensUsed}/${req.user.tokenLimit} tokens used). Please upgrade your plan.`,
        quota: {
          totalTokensUsed: req.user.totalTokensUsed,
          tokenLimit: req.user.tokenLimit,
        },
      });
    }

    // 1. If stream requested via /api/chat, redirect to streaming handler
    if (stream) {
      return handleStreamRequest(req, res);
    }

    // 2. Fetch RAG context and Conversation History in parallel
    const [ragData, historyData] = await Promise.all([
      retrieveRAGContext(question, documentId, topK),
      getRecentHistory(conversationId),
    ]);

    const { context, topChunks } = ragData;
    const { historyText } = historyData;

    // 3. Assemble prompt
    const prompt = buildPrompt({ context, historyText, question });

    // 4. Token Counting (Budget estimation)
    let promptTokens = 0;
    try {
      const countRes = await ai.models.countTokens({
        model: CANDIDATE_MODELS[0],
        contents: prompt,
      });
      promptTokens = countRes.totalTokens || 0;
    } catch (e) {
      // Token counting is non-fatal
    }

    // 5. Generate content with Gemini (with multi-model fallback)
    const { text: answer, modelUsed } = await generateWithFallback(prompt);

    // 6. Response token estimation
    let responseTokens = 0;
    try {
      const countRes = await ai.models.countTokens({
        model: modelUsed || CANDIDATE_MODELS[0],
        contents: answer,
      });
      responseTokens = countRes.totalTokens || 0;
    } catch (e) {}

    const totalTokens = promptTokens + responseTokens;

    // 7. Save messages to conversation history if conversationId provided
    const sources = topChunks.map((c) => ({
      documentName: c.documentName,
      score: parseFloat(c.score.toFixed(4)),
      preview: c.content.slice(0, 200) + "...",
    }));

    if (conversationId) {
      // Save User Message
      await Message.create({
        conversationId,
        role: "user",
        content: question,
        tokens: promptTokens,
      });

      // Save Model Message
      await Message.create({
        conversationId,
        role: "model",
        content: answer,
        sources,
        tokens: responseTokens,
      });

      // Update Conversation total tokens and title if new
      const conv = await Conversation.findById(conversationId);
      if (conv) {
        conv.totalTokensUsed = (conv.totalTokensUsed || 0) + totalTokens;
        if (conv.title === "New Chat") {
          conv.title = question.slice(0, 40) + (question.length > 40 ? "..." : "");
        }
        await conv.save();
      }
    }

    // 8. Deduct / Accumulate tokens for the authenticated user
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { totalTokensUsed: totalTokens },
      });
    }

    res.json({
      answer,
      conversationId: conversationId || null,
      sources,
      usage: {
        promptTokens,
        responseTokens,
        totalTokens,
      },
    });
  } catch (err) {
    console.error("❌ Chat error:", err.message);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

// ── POST /api/chat/stream (Real-Time SSE Streaming like ChatGPT) ──────────────
router.post("/stream", handleStreamRequest);

async function handleStreamRequest(req, res) {
  const { question, documentId, conversationId, topK = 5 } = req.body;

  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "Please provide a non-empty 'question' field." });
  }

  // Set SSE Headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const [ragData, historyData] = await Promise.all([
      retrieveRAGContext(question, documentId, topK),
      getRecentHistory(conversationId),
    ]);

    const { context, topChunks } = ragData;
    const { historyText } = historyData;

    const sources = topChunks.map((c) => ({
      documentName: c.documentName,
      score: parseFloat(c.score.toFixed(4)),
      preview: c.content.slice(0, 200) + "...",
    }));

    // Send sources metadata first
    res.write(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`);

    const prompt = buildPrompt({ context, historyText, question });

    // Stream generation from Gemini (with automatic fallback)
    const { stream: responseStream } = await streamWithFallback(prompt);

    let fullAnswer = "";

    for await (const chunk of responseStream) {
      const textChunk = typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
      if (textChunk) {
        fullAnswer += textChunk;
        res.write(`data: ${JSON.stringify({ type: "chunk", text: textChunk })}\n\n`);
      }
    }

    // Save messages in history
    if (conversationId) {
      await Message.create({
        conversationId,
        role: "user",
        content: question,
      });

      await Message.create({
        conversationId,
        role: "model",
        content: fullAnswer,
        sources,
      });

      const conv = await Conversation.findById(conversationId);
      if (conv && conv.title === "New Chat") {
        conv.title = question.slice(0, 40) + (question.length > 40 ? "..." : "");
        await conv.save();
      }
    }

    // Deduct tokens for user in streaming mode
    if (req.user) {
      const streamTokens = Math.ceil((prompt.length + fullAnswer.length) / 4);
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { totalTokensUsed: streamTokens },
      });
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("❌ Streaming error:", err.message);
    res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
    res.end();
  }
}

// ── GET /api/chat/mcp-tools (List connected MCP tools) ─────────────────────────
router.get("/mcp-tools", (req, res) => {
  const tools = getAvailableMCPTools();
  res.json({ count: tools.length, tools });
});

module.exports = router;
