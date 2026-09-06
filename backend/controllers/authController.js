/**
 * ============================================================
 * Authentication Controller
 * ============================================================
 * Handles all authentication-related business logic:
 *
 *  register         — Create a new user account
 *  login            — Authenticate and issue a JWT
 *  getProfile       — Return the authenticated user's profile
 *  updatePreferences — Update language preferences
 *
 * Each handler follows a consistent pattern:
 *  1. Extract & validate input (validation done by middleware)
 *  2. Perform business logic
 *  3. Return standardised response via apiResponse helpers
 *  4. Pass errors to next() for the global error handler
 *
 * Security decisions are documented inline.
 * ============================================================
 */

const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const { generateToken } = require('../utils/jwt');
const { sendSuccess } = require('../utils/apiResponse');
const ApiError = require('../utils/ApiError');
const { sendOtpEmail, sendPasswordResetEmail } = require('../utils/email');
const config = require('../config/environment');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

// ============================================================
// POST /api/auth/register
// ============================================================
/**
 * Register a new user account.
 *
 * Flow:
 *  1. Check if email is already registered (prevents Mongoose
 *     duplicate key error with a friendlier message)
 *  2. Create user (password hashed automatically by pre-save hook)
 *  3. Generate JWT
 *  4. Return sanitised user + token
 */
const register = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;

    // ---- 1. Check for existing user ----
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw ApiError.conflict('An account with this email already exists');
    }

    // ---- 2. Check PendingUser ----
    // Generate a random 6-digit number string
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Hash the password and OTP securely
    const salt = await bcrypt.genSalt(config.BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otpHash = await bcrypt.hash(otp, salt);

    // ---- 3. Upsert PendingUser ----
    // Using findOneAndUpdate with upsert to cleanly handle re-registrations
    await PendingUser.findOneAndUpdate(
      { email: email.toLowerCase() },
      {
        fullName,
        email: email.toLowerCase(),
        password: hashedPassword,
        otpHash,
        createdAt: new Date(), // Reset TTL timer
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // ---- 4. Send Email ----
    await sendOtpEmail(email, otp);

    // ---- 5. Return sanitised response ----
    // Notice we do NOT return a token here. They must verify first.
    return sendSuccess(res, 201, 'Account registration started. Please verify your email.', {
      user: { fullName, email },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/auth/login
// ============================================================
/**
 * Authenticate a user and return a JWT.
 *
 * Security:
 *  - Uses a single generic error message for both "user not found"
 *    and "wrong password" to prevent email enumeration attacks.
 *  - Explicitly fetches password via `.select('+password')` since
 *    it's excluded by default.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // ---- 1. Find user with password field ----
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );

    // ---- 2. Check credentials ----
    // Use the same error message for both cases to prevent
    // an attacker from determining which field is incorrect
    if (!user || !(await user.comparePassword(password))) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // ---- 3. Update last login timestamp ----
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    // ---- 5. Generate JWT ----
    const token = generateToken(user._id);

    // ---- 6. Return sanitised response ----
    return sendSuccess(res, 200, 'Logged in successfully', {
      token,
      user: user.toSanitizedJSON(),
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/users/profile
// ============================================================
/**
 * Return the authenticated user's profile.
 *
 * `req.user` is set by the `protect` middleware and already
 * excludes the password field (select: false on the schema).
 */
const getProfile = async (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'Profile retrieved successfully', {
      user: req.user.toSanitizedJSON(),
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PUT /api/users/profile
// ============================================================
/**
 * Update the authenticated user's profile.
 * Allows updating fullName, email, phoneNumber, and preferences.
 */
const updateProfile = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, sourceLanguage, targetLanguage, currentPassword } = req.body;

    // ---- Changing the email address is privileged ----
    // The email is the account's recovery channel: whoever controls it can
    // reset the password. Allowing a change on the bearer token alone turns a
    // stolen or leaked JWT into permanent account takeover, so re-authenticate
    // with the current password first.
    if (email && email.toLowerCase() !== req.user.email) {
      const withPassword = await User.findById(req.user._id).select('+password');

      if (!withPassword.password) {
        // Google-only accounts have no local password to check against, and
        // their address is owned by Google.
        throw ApiError.of(
          400,
          'EMAIL_CHANGE_NOT_ALLOWED',
          'This account signs in with Google, so its email address cannot be changed here.'
        );
      }

      if (!currentPassword) {
        throw ApiError.of(
          400,
          'CURRENT_PASSWORD_REQUIRED',
          'Enter your current password to change your email address.'
        );
      }

      const passwordMatches = await withPassword.comparePassword(currentPassword);
      if (!passwordMatches) {
        throw ApiError.of(401, 'INVALID_CREDENTIALS', 'That password is not correct.');
      }

      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        throw ApiError.conflict('Email address is already in use');
      }
      req.user.email = email.toLowerCase();
    }

    if (fullName) {
      req.user.fullName = fullName;
    }
    
    if (phoneNumber !== undefined) {
      req.user.phoneNumber = phoneNumber;
    }

    if (sourceLanguage !== undefined) {
      req.user.preferences.spokenLanguage = sourceLanguage;
    }
    if (targetLanguage !== undefined) {
      req.user.preferences.listeningLanguage = targetLanguage;
    }

    await req.user.save();

    return sendSuccess(res, 200, 'Profile updated successfully', {
      user: req.user.toSanitizedJSON(),
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Validation failed' });
    }
    next(err);
  }
};

// ============================================================
// PATCH /api/users/preferences
// ============================================================
/**
 * Update the authenticated user's language preferences.
 *
 * Only updates the fields that are actually provided in the
 * request body, leaving the rest unchanged.
 */
const updatePreferences = async (req, res, next) => {
  try {
    const { spokenLanguage, listeningLanguage } = req.body;

    // Only update fields that were actually sent
    if (spokenLanguage !== undefined) {
      req.user.preferences.spokenLanguage = spokenLanguage;
    }
    if (listeningLanguage !== undefined) {
      req.user.preferences.listeningLanguage = listeningLanguage;
    }

    await req.user.save();

    return sendSuccess(res, 200, 'Preferences updated successfully', {
      user: req.user.toSanitizedJSON(),
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PUT /api/users/password
// ============================================================
/**
 * Update the authenticated user's password.
 *
 * Flow:
 *  1. Verify the current password.
 *  2. Update to the new password (hashing is handled by the pre-save hook).
 *  3. Return a success message.
 */
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // We must fetch the user with the password field explicitly
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Verify current password
    if (!(await user.comparePassword(currentPassword))) {
      throw ApiError.unauthorized('Incorrect current password');
    }

    // Update to new password
    user.password = newPassword;
    await user.save();

    return sendSuccess(res, 200, 'Password updated successfully');
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DELETE /api/users/profile
// ============================================================
/**
 * Permanently delete the authenticated user's account.
 */
const deleteAccount = async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.user._id);

    return sendSuccess(res, 200, 'Account deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/auth/verify-otp
// ============================================================
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      throw ApiError.badRequest('Email and OTP are required');
    }

    // Look for them in PendingUser
    const pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });

    if (!pendingUser) {
      // It's possible they are already verified
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw ApiError.badRequest('Email is already verified');
      }
      throw ApiError.badRequest('OTP has expired or is invalid. Please register again.');
    }

    const isMatch = await bcrypt.compare(otp.toString(), pendingUser.otpHash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid OTP code');
    }

    // Promote PendingUser → User through Mongoose so validation, defaults
    // and timestamps all apply. The password is ALREADY hashed, so we tell
    // the pre-save hook to skip hashing via $locals (see models/User.js).
    const user = new User({
      fullName: pendingUser.fullName,
      email: pendingUser.email,
      password: pendingUser.password, // already bcrypt-hashed at register time
      authProvider: 'local',
      lastLoginAt: new Date(),
    });
    user.$locals.passwordAlreadyHashed = true;
    await user.save();

    // Delete the pending record
    await PendingUser.deleteOne({ _id: pendingUser._id });

    // Generate JWT now that they are verified
    const token = generateToken(user._id);

    return sendSuccess(res, 200, 'Email verified successfully', {
      token,
      user: user.toSanitizedJSON(),
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/auth/resend-otp
// ============================================================
const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw ApiError.badRequest('Email is required');
    }

    // If they exist in User, they are already verified
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendSuccess(res, 200, 'If this email is registered, an OTP will be sent.');
    }

    const pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });

    if (!pendingUser) {
      // Don't reveal user existence
      return sendSuccess(res, 200, 'If this email is registered, an OTP will be sent.');
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    pendingUser.otpHash = otpHash;
    pendingUser.createdAt = new Date(); // Reset TTL
    await pendingUser.save();

    await sendOtpEmail(pendingUser.email, otp);

    return sendSuccess(res, 200, 'If this email is registered, an OTP will be sent.');
  } catch (err) {
    next(err);
  }
};

/**
 * ============================================================
 * Forgot Password
 * ============================================================
 * Generates a reset token, hashes it, saves to DB, and sends email.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw ApiError.badRequest('Email is required');
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // User requested explicit error instead of generic response
      throw ApiError.notFound('No account found with that email address');
    }

    // 1. Generate plain token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 2. Hash token and set to resetPasswordToken
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // 3. Set expire (15 minutes)
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // 4. Create reset URL from trusted configuration.
    // NEVER build this from Origin/Referer: any HTTP client can set those
    // headers and would receive the victim's reset token on its own domain.
    const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // 5. Send email
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
      return sendSuccess(res, 200, 'If that email is registered, a password reset link has been sent.');
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      throw ApiError.internal('Email could not be sent. Please try again later.');
    }

  } catch (err) {
    next(err);
  }
};

/**
 * ============================================================
 * Reset Password
 * ============================================================
 * Takes the plain token from URL, hashes it, finds user, and updates password.
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      throw ApiError.badRequest('Token and new password are required');
    }

    if (password.length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters');
    }

    // 1. Hash the incoming token
    const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

    // 2. Find user where token matches and has not expired
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      throw ApiError.badRequest('Invalid or expired password reset token');
    }

    // 3. Set new password
    // Pre-save hook will automatically salt and hash the new password.
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // 4. Respond with success (we force them to login manually next)
    return sendSuccess(res, 200, 'Password has been successfully reset. Please log in with your new password.');
  } catch (err) {
    next(err);
  }
};

/**
 * ============================================================
 * Google Auth
 * ============================================================
 * Handles Google Sign-In and Sign-Up.
 * Verifies ID token with Google, then links or creates user.
 */
const googleAuth = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw ApiError.badRequest('Google ID token is required');
    }

    // 1. Verify Google token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: config.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      throw ApiError.unauthorized('Invalid Google ID token');
    }

    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture, email_verified: emailVerified } = payload;

    // Never link or create an account on an email Google has not verified —
    // otherwise anyone controlling an unverified Google identity with a
    // victim's address could take over the victim's local account.
    if (!email || emailVerified !== true) {
      throw ApiError.unauthorized('Google account email is not verified');
    }

    // 2. Check if user exists by email
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // 3a. User exists: Link Google account if not linked
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        if (picture && !user.profilePicture) {
          user.profilePicture = picture;
        }
        await user.save({ validateBeforeSave: false });
      }
    } else {
      // 3b. User does not exist: Create new user via Google
      // We bypass PendingUser since Google verifies the email
      user = await User.create({
        fullName: name,
        email: email.toLowerCase(),
        googleId,
        authProvider: 'google',
        profilePicture: picture,
      });
    }

    // 4. Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    // 5. Generate JWT
    const jwtToken = generateToken(user._id);

    // 6. Return sanitised response
    return sendSuccess(res, 200, 'Logged in with Google successfully', {
      token: jwtToken,
      user: user.toSanitizedJSON(),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  updatePreferences,
  updatePassword,
  deleteAccount,
  googleAuth,
};
