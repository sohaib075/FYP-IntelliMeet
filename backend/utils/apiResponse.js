/**
 * ============================================================
 * Standardised API Response Helpers
 * ============================================================
 * Every response from this API follows a consistent envelope:
 *
 *   {
 *     "success": true | false,
 *     "message": "Human-readable status",
 *     "data":    { ... } | null,        // present on success
 *     "errors":  [ ... ] | undefined,   // present on failure
 *     "timestamp": "ISO-8601"
 *   }
 *
 * This makes the API predictable and easy to consume on the
 * frontend regardless of endpoint.
 * ============================================================
 */

/**
 * Send a standardised success response.
 *
 * @param {import('express').Response} res        - Express response object
 * @param {number}                     statusCode - HTTP status (2xx)
 * @param {string}                     message    - Success message
 * @param {object|null}                [data]     - Response payload
 */
const sendSuccess = (res, statusCode, message, data = null) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
  };

  // Only include data key when there is actual data
  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send a standardised error response.
 *
 * @param {import('express').Response} res        - Express response object
 * @param {number}                     statusCode - HTTP status (4xx / 5xx)
 * @param {string}                     message    - Error message
 * @param {Array}                      [errors]   - Detailed validation errors
 */
const sendError = (res, statusCode, message, errors = [], code = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (code) {
    response.code = code;
  }

  if (errors.length > 0) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendError };
