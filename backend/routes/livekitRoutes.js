/**
 * ============================================================
 * LiveKit Routes
 * ============================================================
 * POST /api/livekit/webhook
 *
 * Authenticated by a LiveKit signature over the raw request body,
 * NOT by a user JWT. Mounted before express.json() and before the
 * general rate limiter (a busy meeting produces a webhook per
 * participant event).
 * ============================================================
 */

const express = require('express');
const router = express.Router();

const { handleWebhook } = require('../controllers/livekitWebhookController');

router.post(
  '/webhook',
  // LiveKit sends application/webhook+json; accept anything so a proxy
  // rewriting the content type cannot silently break signature checks.
  express.raw({ type: '*/*', limit: '256kb' }),
  handleWebhook
);

module.exports = router;
