/**
 * ============================================================
 * Language & Voice Configuration (frontend mirror)
 * ============================================================
 * Mirrors backend/config/languages.js. `code` is the contract between them,
 * and the codes match what User.preferences and the lobby already store, so
 * existing preference data keeps working unchanged.
 *
 * The browser needs `speech` (the BCP-47 locale Azure recognition expects)
 * and `voice` (the neural voice for TTS); the backend needs `translator`.
 * Keeping one shape on both sides means adding a language is the same
 * one-line edit in two files rather than a hunt through the codebase.
 * ============================================================
 */

export interface LanguageConfig {
  /** App-level code, as stored in preferences: 'en', 'ur', … */
  code: string
  label: string
  /** BCP-47 locale for Azure Speech recognition. */
  speech: string
  /** Azure Neural TTS voice used when this is the listener's language. */
  voice: string
  /** Right-to-left script — the transcript UI sets `dir` from this. */
  rtl: boolean
}

export const LANGUAGES: LanguageConfig[] = [
  { code: 'en', label: 'English', speech: 'en-US', voice: 'en-US-JennyNeural', rtl: false },
  { code: 'ur', label: 'Urdu', speech: 'ur-PK', voice: 'ur-PK-UzmaNeural', rtl: true },
  { code: 'ar', label: 'Arabic', speech: 'ar-SA', voice: 'ar-SA-ZariyahNeural', rtl: true },
  { code: 'fr', label: 'French', speech: 'fr-FR', voice: 'fr-FR-DeniseNeural', rtl: false },
  { code: 'es', label: 'Spanish', speech: 'es-ES', voice: 'es-ES-ElviraNeural', rtl: false },
  { code: 'de', label: 'German', speech: 'de-DE', voice: 'de-DE-KatjaNeural', rtl: false },
  { code: 'zh', label: 'Chinese', speech: 'zh-CN', voice: 'zh-CN-XiaoxiaoNeural', rtl: false },
  { code: 'hi', label: 'Hindi', speech: 'hi-IN', voice: 'hi-IN-SwaraNeural', rtl: false },
]

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]))

/** Falls back to English rather than throwing — a stale stored code must not break the room. */
export function getLanguage(code: string | null | undefined): LanguageConfig {
  return (code && BY_CODE.get(code)) || LANGUAGES[0]
}

/** Display name for a code, for labels and transcript rows. */
export function languageLabel(code: string | null | undefined): string {
  return getLanguage(code).label
}
