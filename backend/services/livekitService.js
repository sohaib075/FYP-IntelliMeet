/**
 * ============================================================
 * LiveKit Service
 * ============================================================
 * The ONLY module that touches LIVEKIT_API_SECRET.
 *
 * Everything here is server-side on purpose:
 *  - Tokens are minted after the caller has been authenticated and
 *    authorised. Identity, display name and role are derived from
 *    the database, never from the request body.
 *  - Host actions (remove / mute / delete room) run through the
 *    RoomService admin API, so a leaked participant token cannot
 *    perform them (tokens are issued with roomAdmin: false).
 *
 * If LiveKit is not configured the module still loads; callers use
 * `isConfigured()` and the app falls back to the legacy mesh.
 * ============================================================
 */

const {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
  TrackSource,
} = require('livekit-server-sdk');

const config = require('../config/environment');
const ApiError = require('../utils/ApiError');

/**
 * Participant tokens live just long enough to complete the handshake.
 *
 * Kept deliberately short. LiveKit has no token revocation list, so removing
 * someone does not invalidate the token they already hold - they could
 * reconnect with it by driving the SDK directly and bypassing our API. The
 * TTL bounds that window. Three minutes is ample for a connect (the token is
 * minted on the Join click and used immediately) while keeping the exposure
 * small. The `participant_joined` webhook ejects banned users as well.
 */
const TOKEN_TTL_SECONDS = 180; // 3 minutes

/**
 * Keep a room alive this long BEFORE anyone joins, so a host who creates a
 * meeting and takes a moment to join does not find it gone.
 */
const EMPTY_TIMEOUT_SECONDS = 300; // 5 minutes

/**
 * Keep a room alive this long AFTER the last participant leaves.
 *
 * This must be set explicitly. LiveKit's default is only 20 seconds, and
 * `room_finished` ends the meeting, so without this a momentary gap - every
 * participant reloading at once, or the last person dropping while someone
 * else is still connecting - would permanently end the meeting.
 */
const DEPARTURE_TIMEOUT_SECONDS = 300; // 5 minutes of grace to re-join

/** Safety cap so one meeting cannot exhaust the server. */
const MAX_PARTICIPANTS = 50;

/** True when all three LiveKit variables are present in the environment. */
const isConfigured = () =>
  Boolean(config.LIVEKIT_URL && config.LIVEKIT_API_KEY && config.LIVEKIT_API_SECRET);

/** Lazily built so requiring this module never throws when unconfigured. */
let _roomService = null;
const roomService = () => {
  if (!isConfigured()) {
    throw ApiError.of(
      503,
      'LIVEKIT_NOT_CONFIGURED',
      'The media server is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.'
    );
  }
  if (!_roomService) {
    // RoomService talks HTTP(S); the client SDK uses the ws(s) URL.
    const httpUrl = config.LIVEKIT_URL.replace(/^ws/, 'http');
    _roomService = new RoomServiceClient(httpUrl, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
  }
  return _roomService;
};

/** Wrap SDK failures in a consistent operational error. */
const wrap = async (label, fn) => {
  try {
    return await fn();
  } catch (err) {
    // A 404 from LiveKit means the room/participant is simply not live.
    const status = err && (err.status || err.code);
    if (status === 404 || /not found/i.test(err?.message || '')) {
      return null;
    }
    console.error(`[LiveKit] ${label} failed:`, err?.message || err);
    throw ApiError.of(502, 'LIVEKIT_ERROR', 'The media server is unavailable. Please try again.');
  }
};

// ============================================================
// Tokens
// ============================================================

/**
 * Mint a short-lived participant token.
 *
 * @param {object}  opts
 * @param {string}  opts.roomName             - Meeting.roomName
 * @param {string}  opts.identity             - String(user._id) — stable across refreshes
 * @param {string}  opts.name                 - Display name from the account
 * @param {'HOST'|'PARTICIPANT'} opts.role    - Derived from Meeting.hostId
 * @param {boolean} [opts.screenShareHostOnly]- Restrict screen share to the host
 * @returns {Promise<string>} signed JWT
 */
const createParticipantToken = async ({ roomName, identity, name, role, screenShareHostOnly = false }) => {
  if (!isConfigured()) {
    throw ApiError.of(
      503,
      'LIVEKIT_NOT_CONFIGURED',
      'The media server is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.'
    );
  }

  const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: TOKEN_TTL_SECONDS,
    // Readable by every participant, so tiles can show a host badge.
    // Authority still lives in MongoDB and is re-checked on every action.
    metadata: JSON.stringify({ role }),
  });

  const sources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
  if (role === 'HOST' || !screenShareHostOnly) {
    sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
  }

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true, // in-meeting chat rides on data messages
    canPublishSources: sources,
    canUpdateOwnMetadata: false,
    // Host powers are exercised through our REST API, never by the client,
    // so even the host's token carries no admin rights.
    roomAdmin: false,
  });

  return at.toJwt();
};

// ============================================================
// Rooms
// ============================================================

/**
 * Create the room if it does not exist. Idempotent and safe to call on
 * every token issue. Its only purpose is to pin emptyTimeout and
 * maxParticipants; LiveKit would otherwise create the room implicitly
 * when the first participant connects.
 */
const ensureRoom = (roomName) =>
  wrap('createRoom', () =>
    roomService().createRoom({
      name: roomName,
      emptyTimeout: EMPTY_TIMEOUT_SECONDS,
      departureTimeout: DEPARTURE_TIMEOUT_SECONDS,
      maxParticipants: MAX_PARTICIPANTS,
    })
  );

/** Disconnect everyone and destroy the room. Used by "End for everyone". */
const deleteRoom = (roomName) => wrap('deleteRoom', () => roomService().deleteRoom(roomName));

/** Live participants, or [] when the room is not running. */
const listParticipants = async (roomName) => {
  const result = await wrap('listParticipants', () => roomService().listParticipants(roomName));
  return result || [];
};

/** One live participant, or null when absent. */
const getParticipant = (roomName, identity) =>
  wrap('getParticipant', () => roomService().getParticipant(roomName, identity));

// ============================================================
// Host actions
// ============================================================

/** Immediately disconnect a participant. */
const removeParticipant = (roomName, identity) =>
  wrap('removeParticipant', () => roomService().removeParticipant(roomName, identity));

/**
 * Server-side mute of a participant's camera or microphone.
 * The participant may unmute themselves afterwards, which matches
 * Google Meet's behaviour.
 *
 * @param {'microphone'|'camera'} source
 */
const muteTrack = async (roomName, identity, source) => {
  const participant = await getParticipant(roomName, identity);
  if (!participant) {
    throw ApiError.of(404, 'PARTICIPANT_NOT_FOUND', 'That person is no longer in the meeting.');
  }

  const wanted = source === 'camera' ? TrackSource.CAMERA : TrackSource.MICROPHONE;
  const publication = (participant.tracks || []).find((t) => t.source === wanted && !t.muted);

  if (!publication) {
    throw ApiError.of(
      404,
      'TRACK_NOT_FOUND',
      source === 'camera' ? 'Their camera is already off.' : 'Their microphone is already off.'
    );
  }

  return wrap('mutePublishedTrack', () =>
    roomService().mutePublishedTrack(roomName, identity, publication.sid, true)
  );
};

// ============================================================
// Webhooks
// ============================================================

let _receiver = null;
/** Verifies the signature LiveKit puts in the Authorization header. */
const webhookReceiver = () => {
  if (!isConfigured()) return null;
  if (!_receiver) {
    _receiver = new WebhookReceiver(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
  }
  return _receiver;
};

module.exports = {
  isConfigured,
  createParticipantToken,
  ensureRoom,
  deleteRoom,
  listParticipants,
  getParticipant,
  removeParticipant,
  muteTrack,
  webhookReceiver,
  TOKEN_TTL_SECONDS,
  EMPTY_TIMEOUT_SECONDS,
  DEPARTURE_TIMEOUT_SECONDS,
};
