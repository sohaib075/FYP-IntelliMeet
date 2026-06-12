/**
 * ============================================================
 * Rate Limiter Configuration
 * ============================================================
 * Defines rate-limiting middleware to protect the API from
 * brute-force attacks and abuse.
 *
 *  - authLimiter:    Strict limits on auth endpoints (login/register)
 *  - generalLimiter: Relaxed limits on all other endpoints
 *
 * Uses express-rate-limit which tracks request counts per IP
 * in memory by default. For multi-instance deployments, consider
 * replacing the store with a Redis-backed store.
 * ============================================================
 */

const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/apiResponse');

/**
 * Rate limiter for authentication endpoints.
 * Allows 10 attempts per 15-minute window per IP address.
 * This prevents brute-force login and registration spam.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 10, // Higher limit for local testing
  standardHeaders: true,     // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,      // Disable X-RateLimit-* headers

  // Custom error response matching our standard envelope
  handler: (_req, res) => {
    return sendError(
      res,
      429,
      'Too many authentication attempts — please try again after 15 minutes'
    );
  },
});

/**
 * General rate limiter for all API endpoints.
 * Allows 100 requests per 15-minute window per IP address.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,

  handler: (_req, res) => {
    return sendError(
      res,
      429,
      'Too many requests — please try again later'
    );
  },
});

module.exports = { authLimiter, generalLimiter };
