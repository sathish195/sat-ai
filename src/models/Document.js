const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    name: { type: String, required: true },
    originalName: { type: String, required: true },
    size: { type: Number },
    totalChunks: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "processing",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);
