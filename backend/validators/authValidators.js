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

    return sendError(res, 422, 'Validation failed', formattedErrors, 'VALIDATION_FAILED');
  }

  next();
};

// ============================================================
// Registration Validation Rules
// ============================================================
/**
 * Reject non-strings BEFORE any sanitiser runs.
 *
 * express-validator coerces for validation but leaves req.body untouched, so a
 * JSON array or object reached the controllers intact and crashed them:
 * `POST /api/auth/login` with `{"email":["a@b.com"]}` returned a 500 from
 * `email.toLowerCase is not a function`. isString() must come first in every
 * chain, because trim() and friends would coerce the value out from under it.
 */
const mustBeText = (chain, label) => chain.isString().withMessage(`${label} must be text`);

const registerValidation = [
  mustBeText(body('fullName'), 'Full name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Full name can only contain letters and spaces')
    .escape(), // Sanitise HTML entities

  mustBeText(body('email'), 'Email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(), // Lowercase, remove dots in gmail, etc.

  mustBeText(body('password'), 'Password')
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
  mustBeText(body('email'), 'Email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  mustBeText(body('password'), 'Password')
    .notEmpty()
    .withMessage('Password is required')
    .trim(),

  validate,
];

// ============================================================
// The remaining auth routes
// ============================================================
// These had NO validation at all, so a JSON array or object went straight
// to the controller and crashed it (e.g. `email.toLowerCase is not a
// function` from POST /auth/forgot-password with {"email":[]}).

const emailOnlyValidation = [
  mustBeText(body('email'), 'Email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  validate,
];

const verifyOtpValidation = [
  mustBeText(body('email'), 'Email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  mustBeText(body('otp'), 'Code')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('The verification code is 6 digits')
    .isNumeric()
    .withMessage('The verification code is 6 digits'),

  validate,
];

const resetPasswordValidation = [
  mustBeText(body('token'), 'Reset token').trim().notEmpty().withMessage('Reset token is required'),

  mustBeText(body('password'), 'Password')
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

  validate,
];

const googleAuthValidation = [
  mustBeText(body('token'), 'Google token').notEmpty().withMessage('Google token is required'),
  validate,
];

module.exports = {
  registerValidation,
  loginValidation,
  emailOnlyValidation,
  verifyOtpValidation,
  resetPasswordValidation,
  googleAuthValidation,
  validate,
  mustBeText,
};
