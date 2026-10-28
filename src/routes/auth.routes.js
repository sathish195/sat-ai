const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const { hashPassword, verifyPassword, generateToken } = require("../utils/authUtils");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Please provide a valid name." });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists (duplicate check)
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        error: "This email is already registered. Please login or reset your password.",
        code: "EMAIL_ALREADY_EXISTS",
        email: normalizedEmail,
      });
    }

    // Hash password & create user
    const hashedPassword = hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
    });

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Registration error:", err.message);
    res.status(500).json({ error: err.message || "Failed to register" });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please provide email and password." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = verifyPassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ error: err.message || "Failed to login" });
  }
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ error: "No account found with this email address." });
    }

    // Generate secure 32-byte hex reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Token expires in 1 hour
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    res.json({
      message: "Password reset token generated successfully.",
      resetToken,
      expiresIn: "1 hour",
      instructions: "Send POST /api/auth/reset-password with { token, newPassword } to complete.",
    });
  } catch (err) {
    console.error("❌ Forgot password error:", err.message);
    res.status(500).json({ error: err.message || "Failed to process forgot password" });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Reset token is required." });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    // Find user with active, unexpired token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        error: "Password reset token is invalid or has expired. Please request a new one.",
      });
    }

    // Update password and clear reset token
    user.password = hashPassword(newPassword);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({
      message: "Password reset successful! You can now log in with your new password.",
    });
  } catch (err) {
    console.error("❌ Reset password error:", err.message);
    res.status(500).json({ error: err.message || "Failed to reset password" });
  }
});

// ── GET /api/auth/me (Get profile of logged-in user + token quota) ───────────
router.get("/me", requireAuth, (req, res) => {
  const totalTokensUsed = req.user.totalTokensUsed || 0;
  const tokenLimit = req.user.tokenLimit || 100000;
  const remainingTokens = Math.max(0, tokenLimit - totalTokensUsed);

  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      plan: req.user.plan || "free",
      tokens: {
        totalTokensUsed,
        tokenLimit,
        remainingTokens,
        percentageUsed: parseFloat(((totalTokensUsed / tokenLimit) * 100).toFixed(2)),
      },
      createdAt: req.user.createdAt,
    },
  });
});

// ── GET /api/auth/usage (Get token usage analytics) ───────────────────────────
router.get("/usage", requireAuth, (req, res) => {
  const totalTokensUsed = req.user.totalTokensUsed || 0;
  const tokenLimit = req.user.tokenLimit || 100000;
  const remainingTokens = Math.max(0, tokenLimit - totalTokensUsed);

  res.json({
    plan: req.user.plan || "free",
    totalTokensUsed,
    tokenLimit,
    remainingTokens,
    percentageUsed: parseFloat(((totalTokensUsed / tokenLimit) * 100).toFixed(2)),
  });
});

module.exports = router;
