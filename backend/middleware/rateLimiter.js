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
      'Too many authentication attempts — please try again after 15 minutes',
      [],
      'RATE_LIMITED'
    );
  },
});

/**
 * General rate limiter for all API endpoints.
 * Allows 100 requests per 15-minute window per IP address.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,                  // 600 requests per window (a dashboard behind campus NAT shares one IP)
  standardHeaders: true,
  legacyHeaders: false,

  handler: (_req, res) => {
    return sendError(res, 429, 'Too many requests — please try again later', [], 'RATE_LIMITED');
  },
});

/**
 * Rate limiter for LiveKit token issuance.
 * Keyed by authenticated user (this always runs after `protect`), so one
 * user reloading repeatedly cannot exhaust the quota for everyone sharing
 * a campus NAT. Generous enough for refreshes and reconnects.
 */
const tokenLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => String(req.user?._id || 'anonymous'),

  handler: (_req, res) => {
    return sendError(
      res,
      429,
      'Too many join attempts — please wait a moment and try again',
      [],
      'RATE_LIMITED'
    );
  },
});

/**
 * Live AI translation: one request per finished utterance, so this fires far
 * more often than any other endpoint — roughly every few seconds per speaking
 * participant.
 *
 * Keyed by authenticated user, like `tokenLimiter`. The IP-keyed
 * `generalLimiter` (600 per 15 min, ~40/min for EVERY user behind one campus
 * NAT) would otherwise throttle a normal multi-participant meeting.
 *
 * 120/minute is well above natural speech (an utterance every 2–5 seconds is
 * 12–30/min) while still capping a runaway recogniser or a scripted abuser.
 */
const translationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => String(req.user?._id || 'anonymous'),

  handler: (_req, res) => {
    return sendError(
      res,
      429,
      'Translation is receiving too many requests — please slow down',
      [],
      'RATE_LIMITED'
    );
  },
});

module.exports = { authLimiter, generalLimiter, tokenLimiter, translationLimiter };
