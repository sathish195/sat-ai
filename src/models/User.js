const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    totalTokensUsed: {
      type: Number,
      default: 0,
    },
    tokenLimit: {
      type: Number,
      default: 100000, // 100,000 free tokens per user
    },
    plan: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
