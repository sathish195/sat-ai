const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/auth.routes");
const documentRoutes = require("./src/routes/document.routes");
const chatRoutes = require("./src/routes/chat.routes");
const conversationRoutes = require("./src/routes/conversation.routes");
const { initializeMCP } = require("./src/utils/mcpClient");

const app = express();

// Enable CORS for frontend clients
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "🤖 Production-Ready RAG & Chat API is running",
    endpoints: {
      auth: {
        register: "POST /api/auth/register ({ name, email, password })",
        login: "POST /api/auth/login ({ email, password })",
        forgotPassword: "POST /api/auth/forgot-password ({ email })",
        resetPassword: "POST /api/auth/reset-password ({ token, newPassword })",
        me: "GET /api/auth/me (Header: Authorization: Bearer <token>)",
        usage: "GET /api/auth/usage (Header: Authorization: Bearer <token>)",
      },
      uploadPDF: "POST /api/documents/upload (multipart/form-data, field: pdf)",
      listDocuments: "GET  /api/documents",
      deleteDocument: "DELETE /api/documents/:id",
      chat: "POST /api/chat (JSON: { question, conversationId?, documentId?, stream?, topK? })",
      chatStream: "POST /api/chat/stream (SSE real-time stream like ChatGPT)",
      conversations: {
        create: "POST /api/conversations ({ title?, documentId? })",
        list: "GET /api/conversations",
        getThread: "GET /api/conversations/:id",
        update: "PATCH /api/conversations/:id",
        delete: "DELETE /api/conversations/:id",
      },
      mcpTools: "GET /api/chat/mcp-tools",
    },
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/conversations", conversationRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Production RAG Server started on port ${PORT}`);
    console.log(`🔐 Auth API         : POST http://localhost:${PORT}/api/auth/register | login`);
    console.log(`📄 Upload PDF       : POST http://localhost:${PORT}/api/documents/upload`);
    console.log(`💬 Chat (JSON)      : POST http://localhost:${PORT}/api/chat`);
    console.log(`⚡ Chat (Streaming) : POST http://localhost:${PORT}/api/chat/stream`);
    console.log(`🗂️ Conversations    : GET/POST http://localhost:${PORT}/api/conversations`);

    // Gracefully attempt MCP connection if configured
    initializeMCP().catch(() => {});
  });
});