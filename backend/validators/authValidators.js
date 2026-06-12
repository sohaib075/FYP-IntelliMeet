/**
 * ============================================================
 * Authentication Validators
 * ============================================================
 * express-validator chains for registration and login endpoints.
 * Each validator is an array of middleware that can be spread
 * directly into the route definition.
 *
 * The `validate` middleware at the end of each chain collects
 * all validation errors and returns a 422 response with an
 * array of human-readable messages.
 * ============================================================
 */

const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/apiResponse');

// ============================================================
// Validation Result Handler
// ============================================================
/**
 * Middleware that checks for validation errors accumulated by
 * the preceding express-validator chains. If errors exist, it
 * returns a 422 response and stops the request from reaching
 * the controller.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Map to a clean array of { field, message } objects
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return sendError(res, 422, 'Validation failed', formattedErrors);
  }

  next();
};

// ============================================================
// Registration Validation Rules
// ============================================================
const registerValidation = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
    .escape(), // Sanitise HTML entities

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(), // Lowercase, remove dots in gmail, etc.

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),

  // Run the aggregated check
  validate,
];

// ============================================================
// Login Validation Rules
// ============================================================
const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  validate,
];

module.exports = {
  registerValidation,
  loginValidation,
  validate,
};
