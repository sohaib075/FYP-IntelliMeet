/**
 * ============================================================
 * NoSQL Injection Sanitizer Middleware
 * ============================================================
 * Recursively strips any keys starting with '$' from req.body,
 * req.query, and req.params. This prevents NoSQL injection
 * attacks such as:
 *
 *   POST /api/auth/login
 *   { "email": { "$gt": "" }, "password": { "$gt": "" } }
 *
 * Which would bypass authentication on an unprotected MongoDB
 * query. This middleware neutralises such payloads before they
 * reach any controller or database query.
 * ============================================================
 */

/**
 * Recursively remove keys that start with '$' from an object.
 *
 * @param   {*} obj - Any value (object, array, primitive)
 * @returns {*}     - Sanitised value with dangerous keys removed
 */
const sanitizeValue = (obj) => {
  if (obj === null || obj === undefined) return obj;

  // Handle arrays — sanitise each element
  if (Array.isArray(obj)) {
    return obj.map(sanitizeValue);
  }

  // Handle plain objects — strip '$' keys and recurse
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      // Skip any key starting with '$' (MongoDB operator)
      if (key.startsWith('$')) continue;

      sanitized[key] = sanitizeValue(obj[key]);
    }
    return sanitized;
  }

  // Primitives pass through unchanged
  return obj;
};

/**
 * Express middleware that sanitises all request inputs.
 */
const sanitize = (req, _res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

module.exports = sanitize;
