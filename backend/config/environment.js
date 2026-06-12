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
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  /** Allowed CORS origins (parsed into an array) */
  CORS_ORIGIN: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173'],
};
