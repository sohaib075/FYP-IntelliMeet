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
  return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
};

/**
 * Mongoose duplicate key error (code 11000).
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return ApiError.conflict(
    `An account with this ${field} already exists`
  );
};

/**
 * Mongoose ValidationError — multiple field validation failures.
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return ApiError.unprocessable('Validation failed', errors);
};

/**
 * jsonwebtoken — invalid token signature / format.
 */
const handleJWTError = () => {
  return ApiError.unauthorized('Invalid token — please log in again');
};

/**
 * jsonwebtoken — token expired.
 */
const handleJWTExpiredError = () => {
  return ApiError.unauthorized('Token has expired — please log in again');
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

  // ---- Determine status code ----
  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational || false;

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
    ]);
  }

  // Production — only expose operational error messages
  if (isOperational) {
    return sendError(res, statusCode, error.message, error.errors || []);
  }

  // Non-operational in production — return a generic message
  return sendError(res, 500, 'Something went wrong — please try again later');
};

module.exports = errorHandler;
