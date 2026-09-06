/**
 * ============================================================
 * Meeting Service
 * ============================================================
 * Pure business logic for meetings. No Express objects here so
 * the same functions serve the REST controllers and the socket
 * layer (and later the LiveKit webhook handler).
 * ============================================================
 */

const Meeting = require('../models/Meeting');
const ApiError = require('../utils/ApiError');
const { generateMeetingId } = require('../utils/meetingId');

const MAX_ID_ATTEMPTS = 5;

/**
 * Create a meeting owned by `hostId`. Retries on the (astronomically
 * unlikely) duplicate-key collision.
 */
const createMeeting = async ({ hostId, title, scheduledFor }) => {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const meetingId = generateMeetingId();
    try {
      const meeting = await Meeting.create({
        meetingId,
        roomName: meetingId,
        title: title && title.trim() ? title.trim() : 'Untitled meeting',
        hostId,
        scheduledFor: scheduledFor || null,
      });
      return meeting;
    } catch (err) {
      if (err.code === 11000) continue; // collision — try another id
      throw err;
    }
  }
  throw ApiError.of(500, 'ROOM_CREATION_FAILED', 'Could not allocate a meeting id. Please try again.');
};

/** Find by public code, with the host's name populated. Returns null if absent. */
const findByMeetingId = (meetingId) =>
  Meeting.findOne({ meetingId }).populate('hostId', 'fullName');

/**
 * Throw the right error if `user` may not join `meeting` right now.
 * Order matters: banned users are refused even from ended meetings.
 */
const assertJoinable = (meeting, user) => {
  if (meeting.isBanned(user._id)) {
    throw ApiError.of(403, 'PARTICIPANT_BANNED', "You were removed from this meeting and can't rejoin.");
  }
  if (meeting.status === 'ENDED') {
    throw ApiError.of(410, 'MEETING_ENDED', 'This meeting has ended.');
  }
  if (meeting.settings?.locked && !meeting.isHostUser(user._id)) {
    throw ApiError.of(423, 'MEETING_LOCKED', 'The host has locked this meeting.');
  }
};

/** CREATED → ACTIVE (idempotent) */
const markActive = async (meeting) => {
  if (meeting.status !== 'CREATED') return meeting;
  meeting.status = 'ACTIVE';
  meeting.startedAt = meeting.startedAt || new Date();
  await meeting.save();
  return meeting;
};

/** ACTIVE/CREATED → ENDED (idempotent) */
const endMeeting = async (meeting, reason = 'HOST_ENDED') => {
  if (meeting.status === 'ENDED') return meeting;
  meeting.status = 'ENDED';
  meeting.endedAt = new Date();
  meeting.endedReason = reason;
  await meeting.save();
  return meeting;
};

/**
 * Record that a user joined (history only) and flip CREATED → ACTIVE.
 *
 * Both writes are atomic and conditional, because this runs concurrently:
 * React StrictMode double-invokes the join effect in development, a user can
 * double-click Join, and a refresh re-requests a token. A read-then-push
 * would let two racing calls each append the same person, since Mongoose
 * translates array mutations into $push rather than a whole-array replace.
 *
 * Returns the refreshed document; callers should use the return value.
 */
const recordJoin = async (meeting, user) => {
  await Meeting.updateOne(
    // Only append when this user is not already in the history array.
    { _id: meeting._id, 'participants.userId': { $ne: user._id } },
    {
      $push: {
        participants: {
          userId: user._id,
          displayName: user.fullName,
          firstJoinedAt: new Date(),
        },
      },
    }
  );

  await Meeting.updateOne(
    { _id: meeting._id, status: 'CREATED' },
    { $set: { status: 'ACTIVE', startedAt: new Date() } }
  );

  const fresh = await Meeting.findById(meeting._id).populate('hostId', 'fullName');
  return fresh || meeting;
};

const recordLeave = async (meeting, userId) => {
  const entry = meeting.participants.find((p) => String(p.userId) === String(userId));
  if (entry) {
    entry.lastLeftAt = new Date();
    await meeting.save();
  }
  return meeting;
};

const banUser = async (meeting, userId) => {
  if (!meeting.isBanned(userId)) {
    meeting.bannedUserIds.push(userId);
    await meeting.save();
  }
  return meeting;
};

/** Meetings the user hosted or attended, newest first */
const listForUser = (userId, { status } = {}) => {
  const query = {
    $or: [{ hostId: userId }, { 'participants.userId': userId }],
  };
  if (status) query.status = status;
  return Meeting.find(query).sort({ createdAt: -1 }).limit(100).populate('hostId', 'fullName');
};

/** Shape returned to clients. `viewerId` decides the isHost flag. */
const toPublic = (meeting, viewerId) => {
  const host = meeting.hostId && meeting.hostId.fullName !== undefined
    ? { id: String(meeting.hostId._id), name: meeting.hostId.fullName }
    : { id: String(meeting.hostId), name: null };
  return {
    meetingId: meeting.meetingId,
    title: meeting.title,
    status: meeting.status,
    host,
    isHost: viewerId ? meeting.isHostUser(viewerId) : false,
    locked: !!meeting.settings?.locked,
    scheduledFor: meeting.scheduledFor,
    startedAt: meeting.startedAt,
    endedAt: meeting.endedAt,
    createdAt: meeting.createdAt,
    participantCount: meeting.participants.length,
  };
};

module.exports = {
  createMeeting,
  findByMeetingId,
  assertJoinable,
  markActive,
  endMeeting,
  recordJoin,
  recordLeave,
  banUser,
  listForUser,
  toPublic,
};
