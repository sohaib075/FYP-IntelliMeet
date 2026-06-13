/**
 * ============================================================
 * User Routes
 * ============================================================
 * Protected endpoints for authenticated user operations.
 * All routes require a valid JWT (enforced by `protect`).
 *
 * GET   /api/users/profile       — Get current user profile
 * PATCH /api/users/preferences   — Update language preferences
 * ============================================================
 */

const express = require('express');
const router = express.Router();

const {
  getProfile,
  updateProfile,
  updatePreferences,
  updatePassword,
  deleteAccount,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
  updateProfileValidation,
  updatePreferencesValidation,
  updatePasswordValidation,
} = require('../validators/userValidators');

// All routes in this router require authentication
router.use(protect);

// ---- Routes ----

router.get('/profile', getProfile);
router.put('/profile', updateProfileValidation, updateProfile);
router.delete('/profile', deleteAccount);
router.patch('/preferences', updatePreferencesValidation, updatePreferences);
router.put('/password', updatePasswordValidation, updatePassword);

module.exports = router;
