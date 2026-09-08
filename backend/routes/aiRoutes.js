/**
 * ============================================================
 * AI Routes  (/api/ai)
 * ============================================================
 * Endpoints backing the in-meeting real-time translation feature.
 *
 * Every route requires a valid JWT: speech tokens and translation both cost
 * money, so neither is available anonymously.
 * ============================================================
 */

const express = require('express');

const { protect } = require('../middleware/authMiddleware');
const { tokenLimiter, translationLimiter } = require('../middleware/rateLimiter');
const { translateValidation } = require('../validators/aiValidators');
const { getAiConfig, getSpeechToken, translate } = require('../controllers/aiController');

const router = express.Router();

/** Every AI endpoint is for signed-in users only. */
router.use(protect);

/** What this deployment supports. Cheap, and safe to call on meeting load. */
router.get('/config', getAiConfig);

/**
 * Short-lived Azure authorisation token for the browser.
 * Shares `tokenLimiter` with LiveKit joins: both mint a credential, and the
 * client only needs one roughly every nine minutes.
 */
router.post('/speech-token', tokenLimiter, getSpeechToken);

/** One call per finalised utterance — see translationLimiter for the maths. */
router.post('/translate', translationLimiter, translateValidation, translate);

module.exports = router;
