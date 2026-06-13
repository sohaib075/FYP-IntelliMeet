/**
 * ============================================================
 * User Model
 * ============================================================
 * Mongoose schema for the User collection with:
 *  - Automatic password hashing via pre-save hook
 *  - Password comparison instance method
 *  - Sanitised JSON output (strips sensitive fields)
 *  - Password-change detection for JWT invalidation
 *  - Embedded preferences sub-document
 *
 * Security decisions:
 *  - `password` uses `select: false` so it is NEVER returned
 *    by default — it must be explicitly requested via `.select('+password')`.
 *  - Email is stored lowercase and trimmed to prevent duplicates
 *    caused by casing or whitespace differences.
 *  - Indexes: unique index on `email` for fast lookups & uniqueness.
 * ============================================================
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/environment');

// ---- Preferences Sub-Schema ----
const preferencesSchema = new mongoose.Schema(
  {
    /** Default language the user speaks (ISO 639-1 code) */
    spokenLanguage: {
      type: String,
      trim: true,
      maxlength: [10, 'Language code must be at most 10 characters'],
      default: 'en',
    },
    /** Default language the user listens to (ISO 639-1 code) */
    listeningLanguage: {
      type: String,
      trim: true,
      maxlength: [10, 'Language code must be at most 10 characters'],
      default: 'en',
    },
  },
  { _id: false } // No separate _id for embedded sub-documents
);

// ---- User Schema ----
const userSchema = new mongoose.Schema(
  {
    /** User's full display name */
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [50, 'Full name must be at most 50 characters'],
    },

    /** Email address — unique, lowercase, trimmed */
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
    },

    /** Phone Number */
    phoneNumber: {
      type: String,
      trim: true,
      default: null,
      match: [
        /^[0-9+\-\s()]*$/,
        'Please provide a valid phone number',
      ],
    },

    /** Google Account ID */
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },

    /** Profile Picture URL */
    profilePicture: {
      type: String,
      default: null,
    },

    /** Authentication Provider */
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },

    /**
     * Hashed password — NEVER returned by default.
     * Use `.select('+password')` when you need to compare passwords.
     */
    password: {
      type: String,
      required: function () { return !this.googleId; },
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },

    /** Embedded user preferences */
    preferences: {
      type: Map,
      of: String,
      default: () => ({}), // Generates defaults from sub-schema
    },

    /** Hashed token for password reset */
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },

    /** Expiration date for the password reset token */
    resetPasswordExpire: {
      type: Date,
      default: null,
      select: false,
    },

    /** Timestamp of the user's most recent successful login */
    lastLoginAt: {
      type: Date,
      default: null,
    },

    /**
     * Timestamp of the last password change.
     * Used to invalidate JWTs issued before a password change.
     */
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,

    // Customise JSON serialization to strip sensitive fields
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpire;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpire;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ============================================================
// Indexes
// ============================================================
// The `unique: true` on `email` in the schema definition above
// already creates a unique index. No additional index declaration
// is needed here. Additional compound indexes for future features
// (e.g. role-based queries) can be added below.

// ============================================================
// Pre-Save Hook — Password Hashing
// ============================================================
/**
 * Automatically hashes the password whenever it is created or
 * modified. Uses bcryptjs with configurable salt rounds from
 * the environment configuration.
 */
userSchema.pre('save', async function (next) {
  // Only hash if the password field was actually modified
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(config.BCRYPT_SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);

    // Track when the password was changed (skip on initial creation)
    if (!this.isNew) {
      this.passwordChangedAt = new Date(Date.now() - 1000);
      // Subtract 1 second to ensure the JWT issued after the
      // password change is always valid (avoids timing edge case)
    }

    next();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Instance Methods
// ============================================================

/**
 * Compare a candidate password against the stored hash.
 * @param   {string}  candidatePassword - Plain-text password to check
 * @returns {Promise<boolean>}          - True if the password matches
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password || !candidatePassword) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Check whether the password was changed AFTER a JWT was issued.
 * Returns true if the token should be considered invalid.
 *
 * @param   {number}  jwtTimestamp - The `iat` claim from the JWT (seconds)
 * @returns {boolean}              - True if password was changed after token
 */
userSchema.methods.passwordChangedAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(
      this.passwordChangedAt.getTime() / 1000
    );
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

/**
 * Return a sanitised user object safe for API responses.
 * Strips password, __v, and any future sensitive fields.
 *
 * @returns {object} - Clean user object
 */
userSchema.methods.toSanitizedJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.__v;
  return obj;
};

// ============================================================
// Export
// ============================================================
const User = mongoose.model('User', userSchema);

module.exports = User;
