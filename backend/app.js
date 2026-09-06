/**
 * ============================================================
 * IntelliMeet — Express Application
 * ============================================================
 * Builds and returns the configured Express app WITHOUT starting a
 * listener or connecting to MongoDB. `server.js` owns that, and the
 * test harness mounts this directly on an ephemeral port.
 *
 * Middleware execution order matters for security:
 *  1. Helmet (security headers)
 *  2. LiveKit webhooks (raw body, before express.json and the limiter)
 *  3. General rate limiter
 *  4. CORS
 *  5. Body parsers with size limits
 *  6. NoSQL injection sanitiser
 *  7. API routes
 *  8. 404 catch-all
 *  9. Global error handler
 * ============================================================
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config/environment');
const sanitize = require('./middleware/sanitize');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');
const livekitService = require('./services/livekitService');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const livekitRoutes = require('./routes/livekitRoutes');

const app = express();

// Express 5 defaults to the "simple" (flat) query parser; pin it so the
// NoSQL sanitiser's guarantees hold even if the default ever changes.
app.set('query parser', 'simple');

// ---- 1. Security Headers ----
app.use(helmet());

// ---- 2. LiveKit webhooks ----
// Mounted FIRST because the signature is computed over the raw body, so this
// route must see the bytes before express.json() consumes them. It is also
// exempt from the general limiter: a busy meeting emits one webhook per
// participant event, and it authenticates itself with a signature.
app.use('/api/livekit', livekitRoutes);

// ---- 3. CORS Configuration ----
// Must come BEFORE the rate limiter. Otherwise a 429 is sent without the
// Access-Control-Allow-Origin header, the browser blocks the response, and
// the user sees "Unable to connect to server" instead of being told they
// have been rate limited.
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);

// ---- 4. General Rate Limiter ----
app.use('/api', generalLimiter);

// ---- 5. Body Parsers ----
// Limit payload size to prevent large payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ---- 6. NoSQL Injection Sanitiser ----
app.use(sanitize);

// ============================================================
// API Routes
// ============================================================

/** Health check — useful for load balancers and monitoring */
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'IntelliMeet API is running',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    // Lets the frontend pick the media path without exposing any credentials
    media: livekitService.isConfigured() ? 'livekit' : 'mesh',
  });
});

/** Authentication routes (register, login) */
app.use('/api/auth', authRoutes);

/** User routes (profile, preferences) — protected */
app.use('/api/users', userRoutes);

/** Meeting routes (create, validate, list, token, host actions) — protected */
app.use('/api/meetings', meetingRoutes);

// ============================================================
// 404 Catch-All (for API routes only)
// Express 5 requires named splat parameters: {*path}
// ============================================================
app.all('/api/{*path}', (req, _res, next) => {
  next(ApiError.of(404, 'NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`));
});

// ============================================================
// Global Error Handler (must be last middleware)
// ============================================================
app.use(errorHandler);

module.exports = app;
