const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "model", "system"],
      required: true,
    },
    content: { type: String, required: true },
    sources: [
      {
        documentName: String,
        score: Number,
        preview: String,
      },
    ],
    tokens: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
