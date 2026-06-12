/**
 * ============================================================
 * Pending User Model
 * ============================================================
 * Holds registration data temporarily until OTP verification.
 * Documents automatically expire and are deleted after 10 minutes
 * to prevent database bloat from abandoned signups.
 * ============================================================
 */

const mongoose = require('mongoose');

const pendingUserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      // We don't make this unique in MongoDB level to avoid conflicts 
      // if someone requests a new OTP multiple times. The controller will handle
      // upserting or finding by email.
    },
    /** Pre-hashed password */
    password: {
      type: String,
      required: true,
    },
    /** Hashed OTP code */
    otpHash: {
      type: String,
      required: true,
    },
    /** 
     * CreatedAt is used for the TTL index.
     * Documents will automatically be removed 10 minutes (600s) after this timestamp.
     */
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // 10 minutes in seconds
    },
  }
);

// We add an index on email for fast lookups during verification
pendingUserSchema.index({ email: 1 });

const PendingUser = mongoose.model('PendingUser', pendingUserSchema);

module.exports = PendingUser;
