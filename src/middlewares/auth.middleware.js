const { verifyToken } = require("../utils/authUtils");
const User = require("../models/User");

/**
 * Extracts Bearer token from Authorization header
 */
function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  return null;
}

/**
 * Middleware: Requires a valid JWT token
 */
async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: "Authentication failed: " + err.message });
  }
}

/**
 * Middleware: Optional authentication (attaches req.user if token valid, continues otherwise)
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        const user = await User.findById(decoded.userId).select("-password");
        if (user) req.user = user;
      }
    }
  } catch (err) {
    // optional, don't block
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
};
