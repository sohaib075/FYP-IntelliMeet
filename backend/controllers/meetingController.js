/**
 * ============================================================
 * Meeting Controller
 * ============================================================
 * Thin HTTP handlers. Authentication (`protect`), id validation
 * (`meetingIdParam`), loading (`loadMeeting`) and host checks
 * (`requireHost`) all run as middleware before these.
 * ============================================================
 */

const meetingService = require('../services/meetingService');
const livekitService = require('../services/livekitService');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const config = require('../config/environment');

const meetingUrl = (meetingId) => `${config.FRONTEND_URL}/meet/${meetingId}`;

/** HOST or PARTICIPANT for this user, derived from the database only. */
const roleFor = (meeting, userId) => (meeting.isHostUser(userId) ? 'HOST' : 'PARTICIPANT');

/** POST /api/meetings */
const createMeeting = async (req, res, next) => {
  try {
    const { title, scheduledFor } = req.body;
    const meeting = await meetingService.createMeeting({
      hostId: req.user._id,
      title,
      scheduledFor,
    });
    await meeting.populate('hostId', 'fullName');

    return sendSuccess(res, 201, 'Meeting created', {
      meeting: {
        ...meetingService.toPublic(meeting, req.user._id),
        url: meetingUrl(meeting.meetingId),
      },
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/meetings */
const listMyMeetings = async (req, res, next) => {
  try {
    const meetings = await meetingService.listForUser(req.user._id, { status: req.query.status });
    return sendSuccess(res, 200, 'Meetings retrieved', {
      meetings: meetings.map((m) => ({
        ...meetingService.toPublic(m, req.user._id),
        url: meetingUrl(m.meetingId),
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/meetings/:meetingId
 * Validation/lookup only. Never creates anything. Banned users get 403
 * so the lobby can explain; ended meetings return 200 with status ENDED.
 */
const getMeeting = async (req, res, next) => {
  try {
    const meeting = req.meeting;
    if (meeting.isBanned(req.user._id)) {
      // Same error the join path would give
      meetingService.assertJoinable(meeting, req.user);
    }
    return sendSuccess(res, 200, 'Meeting found', {
      meeting: {
        ...meetingService.toPublic(meeting, req.user._id),
        url: meetingUrl(meeting.meetingId),
      },
    });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/meetings/:meetingId  (host) */
const updateMeeting = async (req, res, next) => {
  try {
    const meeting = req.meeting;
    if (req.body.title !== undefined) meeting.title = req.body.title;
    if (req.body.locked !== undefined) meeting.settings.locked = req.body.locked;
    await meeting.save();
    return sendSuccess(res, 200, 'Meeting updated', {
      meeting: meetingService.toPublic(meeting, req.user._id),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/meetings/:meetingId/end  (host)
 * Marks the meeting ENDED. The real-time layer is told separately
 * (socket broadcast today; LiveKit deleteRoom later).
 */
const endMeeting = async (req, res, next) => {
  try {
    const meeting = req.meeting;
    if (meeting.status === 'ENDED') {
      return sendSuccess(res, 200, 'Meeting already ended', {
        meeting: meetingService.toPublic(meeting, req.user._id),
      });
    }
    await meetingService.endMeeting(meeting, 'HOST_ENDED');

    // Tear down the live session in whichever media layer is running.
    if (livekitService.isConfigured()) {
      await livekitService.deleteRoom(meeting.roomName);
    }
    const realtime = req.app.get('realtime');
    if (realtime && typeof realtime.endRoom === 'function') {
      realtime.endRoom(meeting.meetingId, String(req.user._id));
    }
    return sendSuccess(res, 200, 'Meeting ended', {
      meeting: meetingService.toPublic(meeting, req.user._id),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/meetings/:meetingId/token
 *
 * The single security gate for joining. Authorises the caller, decides
 * their role, then mints a short-lived LiveKit token scoped to this one
 * room. A token is NEVER issued for a meeting that does not exist, has
 * ended, is locked to non-hosts, or that the caller is banned from —
 * which is what stops an arbitrary code from creating a room.
 */
const issueToken = async (req, res, next) => {
  try {
    const meeting = req.meeting;
    const user = req.user;

    // Throws 410 MEETING_ENDED / 403 PARTICIPANT_BANNED / 423 MEETING_LOCKED
    meetingService.assertJoinable(meeting, user);

    if (!livekitService.isConfigured()) {
      throw ApiError.of(
        503,
        'LIVEKIT_NOT_CONFIGURED',
        'The media server is not configured yet.'
      );
    }

    const role = roleFor(meeting, user._id);

    // Idempotent; only pins emptyTimeout / maxParticipants.
    await livekitService.ensureRoom(meeting.roomName);

    const token = await livekitService.createParticipantToken({
      roomName: meeting.roomName,
      identity: String(user._id),
      name: user.fullName,
      role,
      screenShareHostOnly: !!meeting.settings?.screenShareHostOnly,
    });

    // Webhooks are the accurate source for this, but they need a public
    // URL. Recording it here as well keeps history correct in local dev.
    // Use the returned document: recordJoin may have flipped the status
    // and the caller's copy would otherwise still say CREATED.
    const updated = await meetingService.recordJoin(meeting, user);

    return sendSuccess(res, 200, 'Token issued', {
      token,
      url: config.LIVEKIT_URL,
      roomName: meeting.roomName,
      identity: String(user._id),
      name: user.fullName,
      role,
      expiresIn: livekitService.TOKEN_TTL_SECONDS,
      meeting: meetingService.toPublic(updated, user._id),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/meetings/:meetingId/participants/:identity?ban=true
 * Host only. Disconnects the participant, optionally blocking re-entry.
 */
const removeParticipant = async (req, res, next) => {
  try {
    const meeting = req.meeting;
    const { identity } = req.params;

    if (String(identity) === String(req.user._id)) {
      throw ApiError.of(400, 'CANNOT_REMOVE_SELF', 'You cannot remove yourself. Leave the meeting instead.');
    }

    const ban = req.query.ban === 'true' || req.query.ban === '1';

    // Persist the ban first: it is the durable control and must hold even
    // if the media server is unreachable.
    if (ban) await meetingService.banUser(meeting, identity);

    // Disconnecting is best effort — the person may already have dropped off.
    let disconnected = true;
    if (livekitService.isConfigured()) {
      try {
        await livekitService.removeParticipant(meeting.roomName, identity);
      } catch (err) {
        disconnected = false;
        // With no ban there is nothing else to report, so surface the failure.
        if (!ban) throw err;
        console.warn('[Meeting] ban recorded but LiveKit disconnect failed:', err.message);
      }
    }

    // Also disconnect them from the legacy mesh, if that is what is running.
    const realtime = req.app.get('realtime');
    if (realtime && typeof realtime.removeParticipant === 'function') {
      realtime.removeParticipant(meeting.meetingId, String(identity), ban);
    }

    return sendSuccess(
      res,
      200,
      disconnected
        ? 'Participant removed'
        : 'Participant blocked, but the media server could not disconnect them',
      { removed: true, banned: ban, disconnected }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/meetings/:meetingId/participants/:identity/mute
 * Host only. Server-side mute; the participant can unmute themselves later.
 */
const muteParticipant = async (req, res, next) => {
  try {
    const meeting = req.meeting;
    const { identity } = req.params;
    const source = req.body.source === 'camera' ? 'camera' : 'microphone';

    if (livekitService.isConfigured()) {
      await livekitService.muteTrack(meeting.roomName, identity, source);
    } else {
      const realtime = req.app.get('realtime');
      if (!realtime || typeof realtime.forceMedia !== 'function') {
        throw ApiError.of(503, 'LIVEKIT_NOT_CONFIGURED', 'The media server is not configured yet.');
      }
      realtime.forceMedia(meeting.meetingId, String(identity), source === 'camera' ? 'video-off' : 'mute');
    }

    return sendSuccess(res, 200, 'Participant muted', { muted: true, source });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createMeeting,
  listMyMeetings,
  getMeeting,
  updateMeeting,
  endMeeting,
  issueToken,
  removeParticipant,
  muteParticipant,
};
