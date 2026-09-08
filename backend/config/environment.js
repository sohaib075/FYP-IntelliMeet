/**
 * ============================================================
 * Environment Configuration
 * ============================================================
 * Centralises all environment variable access behind a single
 * validated module. The server will fail-fast at startup if any
 * required variable is missing or invalid, preventing silent
 * misconfiguration in production.
 * ============================================================
 */

const dotenv = require('dotenv');
const path = require('path');

// Load .env from the backend root directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ---- Required variable validation ----
const REQUIRED_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `\n❌  Missing required environment variables:\n   ${missing.join('\n   ')}\n`
  );
  console.error('   → Copy .env.example to .env and fill in the values.\n');
  process.exit(1);
}

// ---- Warn if using default JWT secret in production ----
if (
  process.env.NODE_ENV === 'production' &&
  process.env.JWT_SECRET === 'CHANGE_ME_TO_A_STRONG_RANDOM_SECRET'
) {
  console.error(
    '\n❌  JWT_SECRET must be changed from its default value in production.\n'
  );
  process.exit(1);
}

// ---- Export typed configuration ----
module.exports = {
  /** Current runtime environment */
  NODE_ENV: process.env.NODE_ENV || 'development',

  /** Server port */
  PORT: parseInt(process.env.PORT, 10) || 3001,

  /** MongoDB connection URI */
  MONGODB_URI: process.env.MONGODB_URI,

  /** Secret key used to sign JWTs */
  JWT_SECRET: process.env.JWT_SECRET,

  /** JWT token lifetime (e.g. '7d', '24h', '30m') */
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  /** Bcrypt cost factor — higher = slower + more secure */
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,

  /** Google OAuth client id (audience for ID-token verification) */
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,

  /**
   * Public URL of the frontend. Used to build links we put in emails
   * (password reset) and meeting invitations. NEVER derived from
   * request headers, which an attacker controls.
   */
  FRONTEND_URL: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),

  /** LiveKit (optional until the media migration lands) */
  LIVEKIT_URL: process.env.LIVEKIT_URL || null,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || null,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || null,

  /**
   * Azure AI Speech — powers both speech-to-text and neural text-to-speech.
   * One Speech resource serves both, so there is a single key/region pair
   * rather than separate STT and TTS credentials.
   *
   * Optional, exactly like LiveKit above: when absent the AI translation
   * feature reports itself as unconfigured and the meeting runs as normal.
   */
  AZURE_SPEECH_KEY: process.env.AZURE_SPEECH_KEY || null,
  AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION || null,

  /**
   * Translation provider. Azure Translator is preferred (same vendor and
   * region as Speech); Google Cloud Translation is used instead when its key
   * is the one present. See services/translationService.js.
   */
  AZURE_TRANSLATOR_KEY: process.env.AZURE_TRANSLATOR_KEY || null,
  AZURE_TRANSLATOR_REGION: process.env.AZURE_TRANSLATOR_REGION || process.env.AZURE_SPEECH_REGION || null,
  AZURE_TRANSLATOR_ENDPOINT:
    process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com',
  GOOGLE_TRANSLATE_API_KEY: process.env.GOOGLE_TRANSLATE_API_KEY || null,

  /** Allowed CORS origins (parsed into an array) */
  CORS_ORIGIN: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
    ? [/^http:\/\/localhost:\d+$/, ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) : [])]
    : process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
      : ['http://localhost:5173', 'http://localhost:5174'],
};
