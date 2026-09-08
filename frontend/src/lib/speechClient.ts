/**
 * ============================================================
 * Azure Speech client — lazy SDK loading + token lifecycle
 * ============================================================
 * Two jobs, both about keeping cost off the critical path:
 *
 *  1. The Speech SDK is ~1MB. It is loaded with a dynamic import the first
 *     time AI translation is switched ON, so a user who never touches the
 *     feature never downloads it, and the meeting bundle stays as it was.
 *
 *  2. Azure authorisation tokens last 10 minutes. This module fetches one
 *     from our backend, caches it, and refreshes it before expiry — so a
 *     meeting longer than ten minutes does not silently lose recognition.
 *
 * The Azure subscription key is never here. The backend exchanges it for a
 * short-lived token (see backend/services/speechService.js); this module only
 * ever holds that token.
 * ============================================================
 */

import { aiApi } from './api'

/** The SDK's module shape. Imported as a type only, so this stays out of the bundle. */
export type SpeechSDK = typeof import('microsoft-cognitiveservices-speech-sdk')

let sdkPromise: Promise<SpeechSDK> | null = null

/**
 * Load the Speech SDK on first use.
 * Concurrent callers share one import; the browser caches the chunk after that.
 */
export function loadSpeechSDK(): Promise<SpeechSDK> {
  if (!sdkPromise) {
    console.log('[AI] Loading Azure Speech SDK')
    sdkPromise = import('microsoft-cognitiveservices-speech-sdk')
  }
  return sdkPromise
}

interface CachedToken {
  token: string
  region: string
  /** Epoch ms after which we refuse to reuse this token. */
  expiresAt: number
}

let cached: CachedToken | null = null
let inFlight: Promise<CachedToken> | null = null

/** Refresh this long before the advertised expiry, so a long call never straddles it. */
const REFRESH_MARGIN_MS = 60_000

async function fetchToken(): Promise<CachedToken> {
  const { token, region, expiresIn } = await aiApi.getSpeechToken()
  return {
    token,
    region,
    expiresAt: Date.now() + Math.max(0, expiresIn * 1000 - REFRESH_MARGIN_MS),
  }
}

/**
 * A currently-valid Azure token, fetching or refreshing as needed.
 * Throws the underlying ApiError (503 SPEECH_NOT_CONFIGURED etc.) so callers
 * can show the real reason.
 */
export async function getSpeechToken(): Promise<CachedToken> {
  if (cached && Date.now() < cached.expiresAt) return cached
  if (inFlight) return inFlight

  inFlight = fetchToken()
    .then((fresh) => {
      cached = fresh
      return fresh
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

/**
 * Build a SpeechConfig authorised by a fresh token.
 *
 * `fromAuthorizationToken` is the browser-safe constructor — the alternative,
 * `fromSubscription`, would require shipping the secret key to the client.
 */
export async function createSpeechConfig(sdk: SpeechSDK) {
  const { token, region } = await getSpeechToken()
  return sdk.SpeechConfig.fromAuthorizationToken(token, region)
}

/** Drop the cached token — used when Azure rejects it mid-session. */
export function invalidateSpeechToken(): void {
  cached = null
}
