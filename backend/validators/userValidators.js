/**
 * ============================================================
 * User Validators
 * ============================================================
 * express-validator chains for user-related endpoints such as
 * updating preferences.
 * ============================================================
 */

const { body } = require('express-validator');
const { validate } = require('./authValidators');

// ============================================================
// Update Profile Validation Rules
// ============================================================
const updateProfileValidation = [
  body('fullName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Full name cannot be empty')
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9\s.,'-]+$/)
    .withMessage('Full name contains invalid characters'),

  body('email')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Email cannot be empty')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('phoneNumber')
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Please provide a valid phone number')
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters'),

  validate,
];

// ============================================================
// Update Preferences Validation Rules
// ============================================================
const updatePreferencesValidation = [
  body('spokenLanguage')
    .optional()
    .trim()
    .isString()
    .withMessage('Spoken language must be a string')
    .isLength({ min: 2, max: 10 })
    .withMessage('Spoken language code must be between 2 and 10 characters'),

  body('listeningLanguage')
    .optional()
    .trim()
    .isString()
    .withMessage('Listening language must be a string')
    .isLength({ min: 2, max: 10 })
    .withMessage('Listening language code must be between 2 and 10 characters'),

  validate,
];

// ============================================================
// Update Password Validation Rules
// ============================================================
const updatePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .trim()
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/)
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),

  validate,
];

module.exports = {
  updateProfileValidation,
  updatePreferencesValidation,
  updatePasswordValidation,
};
