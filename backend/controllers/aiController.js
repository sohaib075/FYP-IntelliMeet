/**
 * ============================================================
 * AI Controller — speech tokens, translation, capability probe
 * ============================================================
 * Thin request/response layer. All behaviour lives in
 * services/speechService.js and services/translationService.js, which is what
 * lets the tests stub them the same way LiveKit is stubbed.
 * ============================================================
 */

const { sendSuccess } = require('../utils/apiResponse');
const speechService = require('../services/speechService');
const translationService = require('../services/translationService');
const { LANGUAGES } = require('../config/languages');

/**
 * GET /api/ai/config
 *
 * Tells the client what this deployment can actually do, so the UI can show
 * "AI translation is not configured" instead of offering a control that will
 * fail on click. Deliberately exposes capability booleans only — never a key,
 * a region, or which provider is in use.
 */
const getAiConfig = async (_req, res, next) => {
  try {
    return sendSuccess(res, 200, 'AI configuration', {
      speechEnabled: speechService.isConfigured(),
      translationEnabled: translationService.isConfigured(),
      languages: LANGUAGES.map(({ code, label, rtl }) => ({ code, label, rtl })),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/ai/speech-token
 *
 * Exchanges our subscription key for a short-lived Azure authorisation token
 * the browser can use for streaming recognition and neural TTS. The key
 * itself never leaves this server.
 */
const getSpeechToken = async (_req, res, next) => {
  try {
    const { token, region, expiresIn } = await speechService.issueToken();
    return sendSuccess(res, 200, 'Speech token issued', { token, region, expiresIn });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/ai/translate  { text, sourceLanguage, targetLanguage }
 *
 * Returns ONLY the translated text. Called once per finalised utterance —
 * never for interim recognition results.
 */
const translate = async (req, res, next) => {
  try {
    const { text, sourceLanguage, targetLanguage } = req.body;

    const translatedText = await translationService.translateText(
      text,
      sourceLanguage,
      targetLanguage
    );

    // Log that a translation happened and how big it was — never the text
    // itself, which is the content of a private meeting.
    console.log(`[AI] Translated ${sourceLanguage} → ${targetLanguage} (${text.length} chars)`);

    return sendSuccess(res, 200, 'Translated', {
      translatedText,
      sourceLanguage,
      targetLanguage,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getAiConfig, getSpeechToken, translate };
