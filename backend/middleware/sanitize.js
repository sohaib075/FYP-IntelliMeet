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
 *
 * IMPORTANT — why this mutates in place:
 * Under Express 5, `req.query` is a getter on the request prototype.
 * Assigning `req.query = sanitised` is silently discarded in sloppy
 * mode, so the query string was never actually being cleaned. Deleting
 * the offending keys from the existing object works for all three.
 * ============================================================
 */

/**
 * Recursively remove keys that start with '$', mutating the object given.
 *
 * @param {*} value    - Any value (object, array, primitive)
 * @param {number} depth - Guards against pathologically nested payloads
 */
const stripDollarKeys = (value, depth = 0) => {
  if (depth > 10 || value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const entry of value) stripDollarKeys(entry, depth + 1);
    return;
  }

  for (const key of Object.keys(value)) {
    // MongoDB operators are the whole attack surface here.
    if (key.startsWith('$')) {
      delete value[key];
      continue;
    }
    stripDollarKeys(value[key], depth + 1);
  }
};

/**
 * Express middleware that sanitises all request inputs.
 */
const sanitize = (req, _res, next) => {
  stripDollarKeys(req.body);
  stripDollarKeys(req.params);

  // `req.query` is a prototype getter in Express 5 that re-parses the query
  // string on every access, so neither assigning to it nor mutating what it
  // returns has any effect. Read it once, clean that object, then pin it onto
  // the request instance so handlers see the sanitised version.
  try {
    const query = req.query;
    stripDollarKeys(query);
    Object.defineProperty(req, 'query', {
      value: query,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } catch {
    // If the property cannot be redefined, fall through: the pinned "simple"
    // query parser still yields flat strings rather than operator objects.
  }

  next();
};

module.exports = sanitize;
