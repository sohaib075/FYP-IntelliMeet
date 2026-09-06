/**
 * ============================================================
 * Global Error Handler Middleware
 * ============================================================
 * Centralised Express error-handling middleware. It normalises
 * errors from various sources (Mongoose, JWT, custom ApiError)
 * into a consistent response shape before sending to the client.
 *
 * Key principles:
 *  - Operational errors (ApiError) are safe to expose as-is.
 *  - Programming errors are logged and hidden behind a generic
 *    message in production to prevent information leakage.
 *  - Development mode includes the full stack trace for debugging.
 * ============================================================
 */

const ApiError = require('../utils/ApiError');
const { sendError } = require('../utils/apiResponse');
const config = require('../config/environment');

// ---- Error Transformers ----

/**
 * Mongoose CastError — e.g. invalid ObjectId format.
 */
const handleCastError = (err) => {
  return ApiError.of(400, 'INVALID_ID', `Invalid ${err.path}: ${err.value}`);
};

/**
 * Mongoose duplicate key error (code 11000).
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return ApiError.of(409, 'DUPLICATE_KEY', `An account with this ${field} already exists`);
};

/**
 * Mongoose ValidationError — multiple field validation failures.
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return ApiError.of(422, 'VALIDATION_FAILED', 'Validation failed', errors);
};

/**
 * jsonwebtoken — invalid token signature / format.
 */
const handleJWTError = () => {
  // TOKEN_INVALID tells the frontend to clear the session, unlike a 401 from
  // a wrong password, which must not log the user out.
  return ApiError.of(401, 'TOKEN_INVALID', 'Invalid token — please log in again');
};

/**
 * jsonwebtoken — token expired.
 */
const handleJWTExpiredError = () => {
  return ApiError.of(401, 'TOKEN_INVALID', 'Token has expired — please log in again');
};

/**
 * body-parser / http-errors failures — oversized or unparseable request bodies.
 *
 * These need their own transformer because http-errors defines `status` and
 * `statusCode` as NON-ENUMERABLE properties. The spread this handler does to
 * avoid mutating the original error silently drops them, so without this every
 * such error surfaced as a 500 ("request entity too large") instead of the
 * 413 or 400 the client should get.
 */
const handleBodyParserError = (err) => {
  switch (err.type) {
    case 'entity.too.large':
      return ApiError.of(413, 'PAYLOAD_TOO_LARGE', 'That request was too large.');
    case 'entity.parse.failed':
      return ApiError.of(400, 'INVALID_JSON', 'The request body was not valid JSON.');
    case 'encoding.unsupported':
      return ApiError.of(415, 'UNSUPPORTED_ENCODING', 'That content encoding is not supported.');
    default:
      return ApiError.of(
        err.status || err.statusCode || 400,
        'BAD_REQUEST',
        'The request could not be read.'
      );
  }
};

// ============================================================
// Main Error Handler
// ============================================================
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // Clone the error so transformations don't mutate the original
  let error = { ...err, message: err.message, name: err.name };

  // ---- Transform known error types ----
  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateKeyError(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  // body-parser errors carry a `type` and are safe to expose.
  if (typeof err.type === 'string' && err.type.startsWith('entity.')) error = handleBodyParserError(err);
  if (err.type === 'encoding.unsupported') error = handleBodyParserError(err);

  // ---- Determine status code ----
  // Fall back to the ORIGINAL error: http-errors keeps status/statusCode
  // non-enumerable, so the spread above cannot see them.
  const statusCode = error.statusCode || err.statusCode || err.status || 500;
  const isOperational = error.isOperational || err.expose === true || false;
  const code =
    error.code && typeof error.code === 'string'
      ? error.code
      : statusCode === 401
        ? 'UNAUTHORIZED'
        : statusCode === 403
          ? 'FORBIDDEN'
          : statusCode === 422
            ? 'VALIDATION_FAILED'
            : statusCode === 429
              ? 'RATE_LIMITED'
              : null;

  // ---- Log unexpected (non-operational) errors ----
  if (!isOperational) {
    console.error('💥  UNEXPECTED ERROR:', err);
  }

  // ---- Build response ----
  if (config.NODE_ENV === 'development') {
    // Development — include full details for debugging
    return sendError(res, statusCode, error.message, [
      ...(error.errors || []),
      // Include stack trace as the last item for dev convenience
      ...(err.stack ? [{ stack: err.stack }] : []),
    ], code);
  }

  // Production — only expose operational error messages
  if (isOperational) {
    return sendError(res, statusCode, error.message, error.errors || [], code);
  }

  // Non-operational in production — return a generic message
  return sendError(res, 500, 'Something went wrong — please try again later', [], 'INTERNAL_ERROR');
};

module.exports = errorHandler;
