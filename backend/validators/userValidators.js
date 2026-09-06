/**
 * ============================================================
 * User Validators
 * ============================================================
 * express-validator chains for user-related endpoints such as
 * updating preferences.
 * ============================================================
 */

const { body } = require('express-validator');
const { validate, mustBeText } = require('./authValidators');

// ============================================================
// Update Profile Validation Rules
// ============================================================
const updateProfileValidation = [
  mustBeText(body('fullName').optional(), 'Full name')
    .trim()
    .notEmpty()
    .withMessage('Full name cannot be empty')
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9\s.,'-]+$/)
    .withMessage('Full name contains invalid characters'),

  mustBeText(body('email').optional(), 'Email')
    .trim()
    .notEmpty()
    .withMessage('Email cannot be empty')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  // Required by the controller only when the email is actually changing.
  mustBeText(body('currentPassword').optional(), 'Current password'),

  mustBeText(body('phoneNumber').optional(), 'Phone number')
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
  mustBeText(body('spokenLanguage').optional(), 'Spoken language')
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Spoken language code must be between 2 and 10 characters'),

  mustBeText(body('listeningLanguage').optional(), 'Listening language')
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Listening language code must be between 2 and 10 characters'),

  validate,
];

// ============================================================
// Update Password Validation Rules
// ============================================================
const updatePasswordValidation = [
  mustBeText(body('currentPassword'), 'Current password')
    .notEmpty()
    .withMessage('Current password is required'),

  mustBeText(body('newPassword'), 'New password')
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
