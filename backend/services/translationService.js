/**
 * ============================================================
 * Translation Service
 * ============================================================
 * One interface — translateText(text, sourceCode, targetCode) — over whichever
 * provider this deployment is configured for. Callers never learn which one.
 *
 * Provider selection is by credential, not by a separate setting, so there is
 * no way to configure a provider you do not have a key for:
 *   1. Azure Translator   (AZURE_TRANSLATOR_KEY)  — preferred: same vendor and
 *                                                   region as Azure Speech.
 *   2. Google Cloud       (GOOGLE_TRANSLATE_API_KEY)
 *
 * The API key stays here, on the server. The browser only ever sees the
 * translated string.
 * ============================================================
 */

const config = require('../config/environment');
const ApiError = require('../utils/ApiError');
const { getLanguage } = require('../config/languages');

/** A translation is worthless if it arrives after the conversation moved on. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Matches the 10kb express.json limit on the way in, and keeps a runaway
 * recogniser from turning into an expensive request.
 */
const MAX_INPUT_CHARS = 1000;

/** Which provider this deployment will use, or null when none is configured. */
const provider = () => {
  if (config.AZURE_TRANSLATOR_KEY && config.AZURE_TRANSLATOR_REGION) return 'azure';
  if (config.GOOGLE_TRANSLATE_API_KEY) return 'google';
  return null;
};

/** True when some translation provider is usable. */
const isConfigured = () => provider() !== null;

const notConfigured = () =>
  ApiError.of(
    503,
    'TRANSLATION_NOT_CONFIGURED',
    'Translation is not configured. Set AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION, ' +
      'or GOOGLE_TRANSLATE_API_KEY.'
  );

/** Shared failure for anything that goes wrong at the provider. */
const unavailable = () =>
  ApiError.of(503, 'TRANSLATION_UNAVAILABLE', 'Translation is temporarily unavailable.');

/** fetch with a hard deadline, so a hung provider cannot hold the request open. */
const fetchWithTimeout = async (url, options) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    throw unavailable();
  } finally {
    clearTimeout(timer);
  }
};

/** Azure Translator: POST /translate?api-version=3.0&from=..&to=.. */
const translateWithAzure = async (text, from, to) => {
  const url =
    `${config.AZURE_TRANSLATOR_ENDPOINT.replace(/\/$/, '')}/translate` +
    `?api-version=3.0&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': config.AZURE_TRANSLATOR_KEY,
      'Ocp-Apim-Subscription-Region': config.AZURE_TRANSLATOR_REGION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ Text: text }]),
  });

  if (!response.ok) {
    console.error(`[AI] Azure Translator failed with HTTP ${response.status}`);
    throw unavailable();
  }

  const data = await response.json().catch(() => null);
  const translated = data?.[0]?.translations?.[0]?.text;
  if (typeof translated !== 'string') throw unavailable();
  return translated;
};

/** Google Cloud Translation v2, key as a query parameter. */
const translateWithGoogle = async (text, from, to) => {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
    config.GOOGLE_TRANSLATE_API_KEY
  )}`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
  });

  if (!response.ok) {
    console.error(`[AI] Google Translate failed with HTTP ${response.status}`);
    throw unavailable();
  }

  const data = await response.json().catch(() => null);
  const translated = data?.data?.translations?.[0]?.translatedText;
  if (typeof translated !== 'string') throw unavailable();
  return translated;
};

/**
 * Translate one finalised utterance.
 *
 * @param   {string} text        Text to translate (a completed sentence, not a partial).
 * @param   {string} sourceCode  App-level language code, e.g. 'en'.
 * @param   {string} targetCode  App-level language code, e.g. 'ur'.
 * @returns {Promise<string>}    The translated text, and nothing else.
 * @throws  {ApiError} 400 for bad input, 503 when unconfigured or unavailable.
 */
const translateText = async (text, sourceCode, targetCode) => {
  const which = provider();
  if (!which) throw notConfigured();

  if (typeof text !== 'string' || !text.trim()) {
    throw ApiError.of(400, 'TRANSLATION_EMPTY_TEXT', 'There is no text to translate.');
  }
  if (text.length > MAX_INPUT_CHARS) {
    throw ApiError.of(
      400,
      'TRANSLATION_TEXT_TOO_LONG',
      `Text must be ${MAX_INPUT_CHARS} characters or fewer.`
    );
  }

  const source = getLanguage(sourceCode);
  const target = getLanguage(targetCode);
  if (!source || !target) {
    throw ApiError.of(400, 'LANGUAGE_UNSUPPORTED', 'That language is not supported.');
  }

  // Same language in and out: the round-trip would cost money and return the
  // input. Short-circuit so callers do not have to special-case it.
  if (source.code === target.code) return text;

  const translate = which === 'azure' ? translateWithAzure : translateWithGoogle;
  return translate(text.trim(), source.translator, target.translator);
};

module.exports = { isConfigured, translateText, provider, MAX_INPUT_CHARS };
