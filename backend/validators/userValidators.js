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
  updatePreferencesValidation,
  updatePasswordValidation,
};
