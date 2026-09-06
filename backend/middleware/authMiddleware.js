/**
 * ============================================================
 * Authentication Middleware
 * ============================================================
 * Protects routes by verifying JWT tokens and attaching the
 * authenticated user to `req.user`.
 *
 * Flow:
 *  1. Extract Bearer token from the Authorization header
 *  2. Verify & decode the token
 *  3. Fetch the user from the database (excluding password)
 *  4. Check if the user still exists
 *  5. Check if the password was changed after the token was issued
 *  6. Attach user to req.user and proceed
 *
 * Security notes:
 *  - Error messages are kept generic to prevent information leakage
 *  - The user is fetched fresh on every request so permission
 *    changes and account deactivation take effect immediately
 * ============================================================
 */

const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

/**
 * Express middleware that protects a route with JWT authentication.
 * On success, `req.user` contains the full user document (sans password).
 */
const protect = async (req, _res, next) => {
  try {
    // ---- 1. Extract token ----
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw ApiError.of(401, 'TOKEN_INVALID', 'You are not logged in — please provide a valid token');
    }

    // ---- 2. Verify token ----
    const decoded = verifyToken(token);

    // ---- 3. Fetch user (password excluded by default via schema select:false) ----
    const currentUser = await User.findById(decoded.id);

    // ---- 4. Check user still exists ----
    if (!currentUser) {
      throw ApiError.of(401, 'TOKEN_INVALID', 'The user belonging to this token no longer exists');
    }

    // ---- 5. Check if password changed after token was issued ----
    if (currentUser.passwordChangedAfter(decoded.iat)) {
      throw ApiError.of(401, 'TOKEN_INVALID', 'Password was recently changed — please log in again');
    }

    // ---- 6. Grant access ----
    req.user = currentUser;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { protect };
