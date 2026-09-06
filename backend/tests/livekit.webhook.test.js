/**
 * ============================================================
 * POST /api/livekit/webhook
 * ============================================================
 * LiveKit authenticates itself with a JWT in the Authorization header
 * whose `sha256` claim is the base64 SHA-256 of the EXACT raw body, and
 * whose issuer/subject are the LiveKit API key. These tests build that
 * request by hand (jsonwebtoken + crypto) rather than through the SDK,
 * so a change to the verification contract shows up here.
 *
 * The route is mounted before express.json(), so every request below
 * sends a raw string with content-type application/webhook+json.
 *
 * Nothing here touches the network: the LiveKit *service* is stubbed,
 * while the *webhook receiver* (pure signature maths) is the real one.
 * ============================================================
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const h = require('./helpers');
const config = require('../config/environment');
const Meeting = require('../models/Meeting');

// ------------------------------------------------------------
// The webhook answers 503 when LiveKit is unconfigured, because the
// receiver cannot be built without the secret. Skip rather than assert
// on a 503, so a developer without LiveKit credentials sees why.
// ------------------------------------------------------------
const LIVEKIT_CONFIGURED = Boolean(
  config.LIVEKIT_URL && config.LIVEKIT_API_KEY && config.LIVEKIT_API_SECRET
);
const skip = LIVEKIT_CONFIGURED
  ? false
  : 'LIVEKIT_API_SECRET is not set, so the webhook route answers 503 and no signature can be verified';

let lk;
test.before(async () => {
  lk = h.stubLiveKit();
  await h.startServer();
});
test.after(async () => {
  await h.cleanupFixtures();
  await h.stopServer();
  lk.restore();
});

// ============================================================
// Request builders — this is how LiveKit signs a webhook
// ============================================================

/** Serialise one webhook event exactly as it will be transmitted. */
function rawEvent(event, { room, participant } = {}) {
  const payload = {
    event,
    id: `EV_${crypto.randomUUID()}`,
    createdAt: String(Math.floor(Date.now() / 1000)),
  };
  if (room) payload.room = { sid: `RM_${crypto.randomUUID()}`, ...room };
  if (participant) payload.participant = { sid: `PA_${crypto.randomUUID()}`, ...participant };
  return JSON.stringify(payload);
}

/**
 * Build the Authorization header LiveKit sends: a JWT signed with the
 * API secret, carrying the base64 SHA-256 of the raw body.
 */
function authHeaderFor(rawBody, { secret = config.LIVEKIT_API_SECRET, key = config.LIVEKIT_API_KEY } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      iss: key,
      sub: key,
      nbf: now - 10,
      exp: now + 300,
      sha256: crypto.createHash('sha256').update(rawBody, 'utf8').digest('base64'),
    },
    secret,
    { algorithm: 'HS256' }
  );
  return token;
}

/** POST a raw webhook body, optionally with an Authorization header. */
function postWebhook(rawBody, authorization) {
  return h.api('/api/livekit/webhook', {
    method: 'POST',
    body: rawBody,
    headers: {
      'content-type': 'application/webhook+json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
  });
}

/** Signed-and-sent in one step, the happy path. */
function postSigned(event, parts) {
  const raw = rawEvent(event, parts);
  return postWebhook(raw, authHeaderFor(raw));
}

/** Re-read a meeting straight from Mongo: endedReason is not in the public DTO. */
const reload = (meetingId) => Meeting.findOne({ meetingId });

// ============================================================
// Signature verification
// ============================================================

test('rejects a webhook that arrives with no Authorization header', { skip }, async () => {
  const res = await postWebhook(rawEvent('room_started', { room: { name: 'abc-defg-hij' } }));

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'UNAUTHORIZED');
});

test('rejects a webhook signed with the wrong API secret', { skip }, async () => {
  const raw = rawEvent('room_started', { room: { name: 'abc-defg-hij' } });
  const res = await postWebhook(raw, authHeaderFor(raw, { secret: 'not-the-livekit-api-secret' }));

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'UNAUTHORIZED');
});

test('rejects a webhook whose body was altered after it was signed', { skip }, async () => {
  const signed = rawEvent('room_started', { room: { name: 'abc-defg-hij' } });
  const tampered = rawEvent('room_finished', { room: { name: 'abc-defg-hij' } });

  const res = await postWebhook(tampered, authHeaderFor(signed));

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'UNAUTHORIZED');
});

test('accepts a correctly signed webhook and acknowledges it with 200', { skip }, async () => {
  const { token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Signed webhook');

  const res = await postSigned('room_started', { room: { name: meeting.meetingId } });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  // room_started is not an event we act on: the meeting is untouched.
  const stored = await reload(meeting.meetingId);
  assert.equal(stored.status, 'CREATED');
});

// ============================================================
// room_finished
// ============================================================

test('ends the meeting with reason EMPTY_TIMEOUT when room_finished arrives and nobody is connected', { skip }, async () => {
  const { token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Abandoned meeting');

  const res = await postSigned('room_finished', { room: { name: meeting.meetingId } });

  assert.equal(res.status, 200);

  const stored = await reload(meeting.meetingId);
  assert.equal(stored.status, 'ENDED');
  assert.equal(stored.endedReason, 'EMPTY_TIMEOUT');
  assert.ok(stored.endedAt instanceof Date);
});

test('ignores a stale room_finished while LiveKit still reports live participants', { skip }, async () => {
  const { user, token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Reoccupied room');

  // Someone joins, so the meeting goes ACTIVE.
  await postSigned('participant_joined', {
    room: { name: meeting.meetingId },
    participant: { identity: String(user._id), name: user.fullName },
  });
  assert.equal((await reload(meeting.meetingId)).status, 'ACTIVE');

  // A room_finished for the PREVIOUS room instance arrives late, while a
  // fresh room of the same name already has someone in it.
  lk.addParticipant(meeting.meetingId, String(user._id));
  const res = await postSigned('room_finished', { room: { name: meeting.meetingId } });

  assert.equal(res.status, 200);

  const stored = await reload(meeting.meetingId);
  assert.equal(stored.status, 'ACTIVE');
  assert.equal(stored.endedReason, null);
  assert.equal(stored.endedAt, null);
});

// ============================================================
// participant_joined
// ============================================================

test('ejects a banned user who reconnects to the room with a cached token', { skip }, async () => {
  const { user: host, token: hostToken } = await h.makeUser();
  const { user: banned } = await h.makeUser();
  const meeting = await h.makeMeeting(hostToken, 'Banned reconnect');

  const removed = await h.api(
    `/api/meetings/${meeting.meetingId}/participants/${banned._id}?ban=true`,
    { method: 'DELETE', token: hostToken }
  );
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.banned, true);

  const before = lk.calls.length;
  const res = await postSigned('participant_joined', {
    room: { name: meeting.meetingId },
    participant: { identity: String(banned._id), name: banned.fullName },
  });

  assert.equal(res.status, 200);

  const during = lk.calls.slice(before);
  const stored = await reload(meeting.meetingId);
  assert.deepEqual(
    during.filter((c) => c[0] === 'removeParticipant'),
    [['removeParticipant', stored.roomName, String(banned._id)]]
  );

  // The ejection short-circuits the handler: no join is recorded and the
  // meeting is not woken up by someone who is not allowed in.
  assert.equal(stored.status, 'CREATED');
  assert.equal(stored.participants.length, 0);
  assert.equal(String(stored.hostId), String(host._id));
});

// ============================================================
// Unknown rooms
// ============================================================

test('acknowledges an event for an unknown room with 200 and changes nothing', { skip }, async () => {
  const { token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Untouched by strangers');

  const before = lk.calls.length;
  const res = await postSigned('room_finished', { room: { name: 'zzz-zzzz-zzz' } });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  // No lookup of live participants, no ejection: the handler returned early.
  assert.deepEqual(lk.calls.slice(before), []);

  // Our own meeting is unaffected by an event addressed to another room.
  const stored = await reload(meeting.meetingId);
  assert.equal(stored.status, 'CREATED');
  assert.equal(stored.endedReason, null);
});

// ============================================================
// A meeting that has been ended stays ended
// ============================================================

test('closes the room again when someone joins a meeting the host already ended', { skip }, async () => {
  const host = await h.makeUser();
  const meeting = await h.makeMeeting(host.token, 'Already over');

  // The host ends it for everyone. LiveKit deletes the room...
  await h.api(`/api/meetings/${meeting.meetingId}/token`, { method: 'POST', token: host.token });
  await h.api(`/api/meetings/${meeting.meetingId}/end`, { method: 'POST', token: host.token });
  assert.equal((await reload(meeting.meetingId)).status, 'ENDED');

  // ...but a token minted before the end is still valid for its short TTL, and
  // reconnecting with it makes LiveKit silently recreate the room. The webhook
  // is our last line of defence, so "End for everyone" actually means it.
  const latecomer = await h.makeUser();
  const before = lk.calls.length;
  const res = await postSigned('participant_joined', {
    room: { name: meeting.meetingId },
    participant: { identity: String(latecomer.user._id) },
  });

  assert.equal(res.status, 200);

  const after = lk.calls.slice(before);
  assert.ok(
    after.some((c) => c[0] === 'removeParticipant' && c[2] === String(latecomer.user._id)),
    'the latecomer should have been removed from the recreated room'
  );
  assert.ok(
    after.some((c) => c[0] === 'deleteRoom' && c[1] === meeting.meetingId),
    'the recreated room should have been deleted again'
  );

  // They must not be recorded as having attended, and the meeting stays ENDED.
  const stored = await reload(meeting.meetingId);
  assert.equal(stored.status, 'ENDED');
  assert.ok(
    !stored.participants.some((p) => String(p.userId) === String(latecomer.user._id)),
    'a rejected latecomer must not appear in the attendance history'
  );
});
