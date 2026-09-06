/**
 * ============================================================
 * Authentication Routes
 * ============================================================
 * Public endpoints for user registration and login.
 * All routes are rate-limited with the stricter `authLimiter`.
 *
 * POST /api/auth/register  — Create a new account
 * POST /api/auth/login     — Authenticate and get a JWT
 * ============================================================
 */

const express = require('express');
const router = express.Router();

const { register, login, verifyOtp, resendOtp, forgotPassword, resetPassword, googleAuth } = require('../controllers/authController');
const {
  registerValidation,
  loginValidation,
  emailOnlyValidation,
  verifyOtpValidation,
  resetPasswordValidation,
  googleAuthValidation,
} = require('../validators/authValidators');
const { authLimiter } = require('../middleware/rateLimiter');

// Apply auth rate limiter ONCE to all routes in this router.
// (Applying it again per-route double-counts every request.)
router.use(authLimiter);

// ---- Routes ----

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/google', googleAuthValidation, googleAuth);
router.post('/verify-otp', verifyOtpValidation, verifyOtp);
router.post('/resend-otp', emailOnlyValidation, resendOtp);

// Forgot & Reset Password
router.post('/forgot-password', emailOnlyValidation, forgotPassword);
router.post('/reset-password', resetPasswordValidation, resetPassword);

module.exports = router;
