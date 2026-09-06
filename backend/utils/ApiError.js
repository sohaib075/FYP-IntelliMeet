/**
 * ============================================================
 * Custom API Error Class
 * ============================================================
 * Provides a standardised, operational error type that the
 * global error handler can distinguish from unexpected crashes.
 *
 * Usage:
 *   throw ApiError.badRequest('Invalid email format');
 *   throw ApiError.unauthorized('Session expired');
 * ============================================================
 */

class ApiError extends Error {
  /**
   * @param {number}  statusCode  - HTTP status code
   * @param {string}  message     - Human-readable error message
   * @param {Array}   [errors]    - Optional array of detailed validation errors
   */
  constructor(statusCode, message, errors = [], code = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.errors = errors;

    /** Stable machine-readable code, e.g. MEETING_NOT_FOUND */
    this.code = code;

    /**
     * Operational errors are expected (bad input, auth failure, etc.)
     * and are safe to expose to the client. Non-operational errors
     * (bugs, unhandled exceptions) are hidden behind a generic message.
     */
    this.isOperational = true;

    // Capture stack trace, excluding the constructor itself
    Error.captureStackTrace(this, this.constructor);
  }

  // ---- Static Factory Methods ----

  /** Any status with an explicit machine-readable code */
  static of(statusCode, code, message, errors = []) {
    return new ApiError(statusCode, message, errors, code);
  }

  /** 400 — Malformed request or validation failure */
  static badRequest(message = 'Bad request', errors = []) {
    return new ApiError(400, message, errors);
  }

  /** 401 — Missing or invalid authentication */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  /** 403 — Authenticated but lacks permission */
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  /** 404 — Resource not found */
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  /** 409 — Conflict (e.g. duplicate resource) */
  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }

  /** 422 — Unprocessable entity (semantic validation failure) */
  static unprocessable(message = 'Unprocessable entity', errors = []) {
    return new ApiError(422, message, errors);
  }

  /** 429 — Rate limit exceeded */
  static tooManyRequests(message = 'Too many requests — please try again later') {
    return new ApiError(429, message);
  }

  /** 500 — Internal server error */
  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
