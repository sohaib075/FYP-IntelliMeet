/**
 * ============================================================
 * Language & Voice Configuration (single source of truth)
 * ============================================================
 * Every language the AI translation feature supports is declared here once.
 * Adding a language is a one-line change in LANGUAGES below — nothing else in
 * the backend needs to know about it.
 *
 * Why one table instead of three:
 *   The app, Azure Speech, and Azure Translator all use DIFFERENT codes for
 *   the same language. The app has said 'zh' since before this feature
 *   existed (User.preferences.spokenLanguage), Azure Speech wants the BCP-47
 *   locale 'zh-CN', and Azure Translator wants the script-qualified 'zh-Hans'.
 *   Scattering those conversions would guarantee they drift apart.
 *
 * The frontend mirrors this table in frontend/src/lib/languages.ts. The two
 * MUST stay in step; `code` is the contract between them.
 * ============================================================
 */

/**
 * @typedef  {object} LanguageConfig
 * @property {string} code        App-level code. Matches the values already
 *                                stored in User.preferences and chosen in the
 *                                lobby, so existing data keeps working.
 * @property {string} label       Display name.
 * @property {string} speech      BCP-47 locale for Azure Speech recognition.
 * @property {string} translator  Azure Translator language code.
 * @property {string} voice       Azure Neural TTS voice for this language.
 * @property {boolean} rtl        Right-to-left script, for text rendering.
 */

/** @type {LanguageConfig[]} */
const LANGUAGES = [
  { code: 'en', label: 'English',  speech: 'en-US', translator: 'en',      voice: 'en-US-JennyNeural',   rtl: false },
  { code: 'ur', label: 'Urdu',     speech: 'ur-PK', translator: 'ur',      voice: 'ur-PK-UzmaNeural',    rtl: true  },
  { code: 'ar', label: 'Arabic',   speech: 'ar-SA', translator: 'ar',      voice: 'ar-SA-ZariyahNeural', rtl: true  },
  { code: 'fr', label: 'French',   speech: 'fr-FR', translator: 'fr',      voice: 'fr-FR-DeniseNeural',  rtl: false },
  { code: 'es', label: 'Spanish',  speech: 'es-ES', translator: 'es',      voice: 'es-ES-ElviraNeural',  rtl: false },
  { code: 'de', label: 'German',   speech: 'de-DE', translator: 'de',      voice: 'de-DE-KatjaNeural',   rtl: false },
  { code: 'zh', label: 'Chinese',  speech: 'zh-CN', translator: 'zh-Hans', voice: 'zh-CN-XiaoxiaoNeural', rtl: false },
  { code: 'hi', label: 'Hindi',    speech: 'hi-IN', translator: 'hi',      voice: 'hi-IN-SwaraNeural',   rtl: false },
];

/** Fast lookup by app-level code. */
const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

/** All supported app-level codes, e.g. ['en','ur',...]. */
const SUPPORTED_CODES = LANGUAGES.map((l) => l.code);

/**
 * Look up a language by its app-level code.
 * @param   {string} code
 * @returns {LanguageConfig | null} null when unsupported — callers turn that
 *          into a 400 rather than silently guessing a language.
 */
const getLanguage = (code) =>
  (typeof code === 'string' && BY_CODE.get(code.toLowerCase().trim())) || null;

/** True when `code` is a language this deployment supports. */
const isSupported = (code) => getLanguage(code) !== null;

module.exports = { LANGUAGES, SUPPORTED_CODES, getLanguage, isSupported };
