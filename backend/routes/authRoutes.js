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
} = require('../validators/authValidators');
const { authLimiter } = require('../middleware/rateLimiter');

// Apply auth rate limiter to all routes in this router
router.use(authLimiter);

// ---- Routes ----

router.post('/register', authLimiter, registerValidation, register);
router.post('/login', authLimiter, loginValidation, login);
router.post('/google', authLimiter, googleAuth);
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/resend-otp', authLimiter, resendOtp);

// Forgot & Reset Password
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

module.exports = router;
