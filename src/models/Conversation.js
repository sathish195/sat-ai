const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    title: { type: String, default: "New Chat" },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
    systemPrompt: { type: String, default: null },
    totalTokensUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
