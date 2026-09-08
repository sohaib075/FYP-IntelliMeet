/**
 * ============================================================
 * Azure Speech Service — short-lived browser authorisation tokens
 * ============================================================
 * Real-time speech recognition has to run IN THE BROWSER: it needs a
 * continuous audio stream and sub-second interim results, and relaying the
 * microphone through this server would add a hop to every packet for no gain.
 *
 * But the Azure subscription key must never reach the browser. Azure solves
 * this the same way LiveKit does: the server exchanges its secret key for a
 * short-lived authorisation token, and the browser uses only that.
 *
 *   browser  --(our JWT)-->  POST /api/ai/speech-token
 *   server   --(AZURE_SPEECH_KEY)-->  Azure issueToken endpoint
 *   browser  <--(10-minute token)--   token + region
 *   browser  --(token)-->  Azure Speech (STT and TTS)
 *
 * Azure's tokens last 10 minutes. The client refreshes before expiry; a
 * leaked token is therefore useless within minutes and is scoped to the
 * Speech resource alone.
 *
 * This module never throws at require() time — an unconfigured deployment
 * must still boot and run meetings normally.
 * ============================================================
 */

const config = require('../config/environment');
const ApiError = require('../utils/ApiError');

/** Azure issues 10-minute tokens; refresh a little early to avoid a race. */
const TOKEN_TTL_SECONDS = 540; // 9 minutes, advertised to the client

/** Give up rather than letting a hung request hold the caller open. */
const ISSUE_TIMEOUT_MS = 8000;

/** True when this deployment has Azure Speech credentials. */
const isConfigured = () => Boolean(config.AZURE_SPEECH_KEY && config.AZURE_SPEECH_REGION);

/** The error every entry point uses when credentials are absent. */
const notConfigured = () =>
  ApiError.of(
    503,
    'SPEECH_NOT_CONFIGURED',
    'Speech services are not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.'
  );

/**
 * Exchange the subscription key for a browser-safe authorisation token.
 *
 * @returns {Promise<{token: string, region: string, expiresIn: number}>}
 * @throws  {ApiError} 503 when unconfigured or when Azure is unreachable.
 */
const issueToken = async () => {
  if (!isConfigured()) throw notConfigured();

  const url = `https://${config.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ISSUE_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.AZURE_SPEECH_KEY,
        'Content-Length': '0',
      },
      signal: controller.signal,
    });
  } catch (err) {
    // Network failure or our own timeout. Never echo `err` to the client: it
    // can carry the request URL, and the URL carries the region.
    throw ApiError.of(
      503,
      'SPEECH_UNAVAILABLE',
      'Could not reach the speech service. Please try again.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // 401/403 here means a bad or disabled key — a deployment problem, not a
    // user problem. Log enough for the developer, reveal nothing to the client.
    console.error(`[AI] Azure token request failed with HTTP ${response.status}`);
    throw ApiError.of(
      503,
      'SPEECH_UNAVAILABLE',
      'The speech service rejected this deployment. Check the Azure Speech credentials.'
    );
  }

  const token = await response.text();
  if (!token) {
    throw ApiError.of(503, 'SPEECH_UNAVAILABLE', 'The speech service returned an empty token.');
  }

  return { token, region: config.AZURE_SPEECH_REGION, expiresIn: TOKEN_TTL_SECONDS };
};

module.exports = { isConfigured, issueToken, TOKEN_TTL_SECONDS };
