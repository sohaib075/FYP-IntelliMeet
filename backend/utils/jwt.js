/**
 * ============================================================
 * JWT Utility Functions
 * ============================================================
 * Thin wrappers around jsonwebtoken that enforce consistent
 * signing options and provide clear error semantics via ApiError.
 *
 * Token payload contains only the user ID — all other user data
 * is fetched fresh from the database on each request by the auth
 * middleware, ensuring permissions and profile changes take effect
 * immediately.
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const ApiError = require('./ApiError');

/**
 * Generate a signed JWT for the given user.
 *
 * @param   {string} userId - The MongoDB ObjectId of the user
 * @returns {string}        - Signed JWT string
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
};

/**
 * Verify and decode a JWT.
 *
 * @param   {string} token - Raw JWT string (without "Bearer " prefix)
 * @returns {object}       - Decoded token payload ({ id, iat, exp })
 * @throws  {ApiError}     - 401 if token is invalid or expired
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token has expired — please log in again');
    }
    if (err.name === 'JsonWebTokenError') {
      throw ApiError.unauthorized('Invalid token — please log in again');
    }
    throw ApiError.unauthorized('Authentication failed');
  }
};

module.exports = { generateToken, verifyToken };
