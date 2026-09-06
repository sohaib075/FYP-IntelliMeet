/**
 * ============================================================
 * Meeting Model
 * ============================================================
 * Persistent record of a meeting. Presence, tracks, and mute
 * state are NOT stored here — they live in the real-time layer.
 *
 * Lifecycle:  CREATED → ACTIVE → ENDED
 *  - CREATED: created by the host, nobody has joined yet
 *  - ACTIVE:  the host (or first participant) has joined
 *  - ENDED:   terminal; joins are refused
 * ============================================================
 */

const mongoose = require('mongoose');
const { MEETING_ID_PATTERN } = require('../utils/meetingId');

const participantHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, trim: true },
    firstJoinedAt: { type: Date, default: Date.now },
    lastLeftAt: { type: Date, default: null },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    /** Public, shareable code — e.g. abc-defg-hij */
    meetingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: [MEETING_ID_PATTERN, 'Invalid meeting id format'],
    },

    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Title must be at most 100 characters'],
      default: 'Untitled meeting',
    },

    /** The creator. The ONLY source of host authority. */
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['CREATED', 'ACTIVE', 'ENDED'],
      default: 'CREATED',
      index: true,
    },

    /** Real-time room name (LiveKit later). Equals meetingId today. */
    roomName: { type: String, required: true },

    /** Optional scheduled start (metadata only; does not gate joining) */
    scheduledFor: { type: Date, default: null },

    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    endedReason: {
      type: String,
      enum: ['HOST_ENDED', 'EMPTY_TIMEOUT', null],
      default: null,
    },

    settings: {
      locked: { type: Boolean, default: false },
      screenShareHostOnly: { type: Boolean, default: false },
    },

    /** Users removed with "block" — the token/join path refuses them */
    bannedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    /** Join history for the dashboard. Never used for presence. */
    participants: [participantHistorySchema],
  },
  { timestamps: true }
);

meetingSchema.index({ hostId: 1, createdAt: -1 });
meetingSchema.index({ 'participants.userId': 1, createdAt: -1 });

/** True if the given user id is the host of this meeting */
meetingSchema.methods.isHostUser = function (userId) {
  return String(this.hostId?._id || this.hostId) === String(userId);
};

/** True if the given user id has been banned from this meeting */
meetingSchema.methods.isBanned = function (userId) {
  return this.bannedUserIds.some((id) => String(id) === String(userId));
};

module.exports = mongoose.model('Meeting', meetingSchema);
