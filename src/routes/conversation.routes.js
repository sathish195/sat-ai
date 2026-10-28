const express = require("express");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { optionalAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.use(optionalAuth);

// ── POST /api/conversations (Create new conversation) ─────────────────────────
router.post("/", async (req, res) => {
  try {
    const { title = "New Chat", documentId = null } = req.body;
    const conversation = await Conversation.create({
      userId: req.user ? req.user._id : null,
      title,
      documentId: documentId || null,
    });
    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/conversations (List all conversations for user) ──────────────────
router.get("/", async (req, res) => {
  try {
    // If logged in, filter by user; otherwise return unassigned/all
    const filter = req.user ? { userId: req.user._id } : {};
    const conversations = await Conversation.find(filter)
      .populate("documentId", "name originalName")
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/conversations/:id (Get conversation + messages) ──────────────────
router.get("/:id", async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user) {
      filter.$or = [{ userId: req.user._id }, { userId: null }];
    }

    const conversation = await Conversation.findOne(filter)
      .populate("documentId", "name originalName")
      .lean();

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await Message.find({ conversationId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();

    res.json({ conversation, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/conversations/:id (Update title / document) ────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const { title, documentId } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (documentId !== undefined) updates.documentId = documentId;
    updates.updatedAt = new Date();

    const filter = { _id: req.params.id };
    if (req.user) filter.userId = req.user._id;

    const conversation = await Conversation.findOneAndUpdate(
      filter,
      updates,
      { new: true }
    );
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found or unauthorized" });
    }
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/conversations/:id (Delete thread + all messages) ──────────────
router.delete("/:id", async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user) filter.userId = req.user._id;

    const deleted = await Conversation.findOneAndDelete(filter);
    if (!deleted) {
      return res.status(404).json({ error: "Conversation not found or unauthorized" });
    }

    await Message.deleteMany({ conversationId: req.params.id });
    res.json({ message: "Conversation and its messages deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
