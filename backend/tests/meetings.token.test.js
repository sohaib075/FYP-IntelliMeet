/**
 * ============================================================
 * POST /api/meetings/:meetingId/token — the security gate
 * ============================================================
 * This one endpoint decides who is allowed into a room, what role
 * they get, and whether a room is provisioned at all. Everything it
 * returns must be derived from the database, never from the caller.
 *
 * The tests below lock down:
 *   - authentication is required
 *   - malformed codes 400, unknown codes 404, and neither provisions a room
 *   - role/identity come from the server, not the request body
 *   - ended meetings 410, banned users 403 — and no token is minted
 *   - ensureRoom is called so the room exists before the token is used
 *   - the first token flips the meeting CREATED -> ACTIVE
 *   - concurrent joins record each person exactly once (duplicate-row bug)
 * ============================================================
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const h = require('./helpers');

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

// ---- local utilities (no ordering dependency, no Date.now) ----

/** A well-formed but almost certainly unused meeting code. */
const randomCode = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const letters = [...crypto.randomBytes(10)].map((b) => alphabet[b % 26]).join('');
  return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7, 10)}`;
};

const tokenPath = (meetingId) => `/api/meetings/${meetingId}/token`;

/** Calls the server made to LiveKit for one specific room. */
const callsFor = (method, roomName) =>
  lk.calls.filter((c) => c[0] === method && (method === 'createParticipantToken' ? c[1].roomName === roomName : c[1] === roomName));

/** Decode a JWT payload without needing the signing secret. */
const decodePayload = (jwtString) => {
  const part = jwtString.split('.')[1];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
};

// ============================================================
// Authentication
// ============================================================

test('refuses to issue a token when the request carries no bearer token', async () => {
  const res = await h.api(tokenPath(randomCode()), { method: 'POST' });

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
});

test('refuses to issue a token when the bearer token is not a valid JWT', async () => {
  const res = await h.api(tokenPath(randomCode()), { method: 'POST', token: 'not-a-real-jwt' });

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
});

// ============================================================
// Meeting code validation
// ============================================================

test('rejects a malformed meeting code with 400 INVALID_MEETING_ID', async () => {
  const { token } = await h.makeUser();

  const res = await h.api(tokenPath('nope'), { method: 'POST', token });

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_MEETING_ID');
});

test('rejects a well-formed but unknown meeting code with 404 and provisions no room', async () => {
  const { token } = await h.makeUser();
  const unknown = randomCode();

  const res = await h.api(tokenPath(unknown), { method: 'POST', token });

  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'MEETING_NOT_FOUND');
  // An arbitrary code must never conjure a room into existence.
  assert.equal(callsFor('ensureRoom', unknown).length, 0);
  assert.equal(callsFor('createParticipantToken', unknown).length, 0);
});

// ============================================================
// Role derivation
// ============================================================

test('gives the meeting host the role HOST and provisions the room first', async () => {
  const { user, token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Host joins');

  const res = await h.api(tokenPath(meeting.meetingId), { method: 'POST', token });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.role, 'HOST');
  assert.equal(res.body.data.roomName, meeting.meetingId);
  assert.equal(res.body.data.identity, String(user._id));
  assert.equal(res.body.data.name, user.fullName);
  assert.ok(res.body.data.token, 'a LiveKit token should be returned');

  // The room is provisioned before anyone tries to connect with the token.
  assert.equal(callsFor('ensureRoom', meeting.meetingId).length, 1);
  const minted = callsFor('createParticipantToken', meeting.meetingId);
  assert.equal(minted.length, 1);
  assert.equal(minted[0][1].role, 'HOST');
});

test('gives a non-host the role PARTICIPANT', async () => {
  const { token: hostToken } = await h.makeUser();
  const { user: guest, token: guestToken } = await h.makeUser();
  const meeting = await h.makeMeeting(hostToken, 'Guest joins');

  const res = await h.api(tokenPath(meeting.meetingId), { method: 'POST', token: guestToken });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.role, 'PARTICIPANT');
  assert.equal(res.body.data.identity, String(guest._id));
  assert.equal(res.body.data.meeting.isHost, false);
});

test('derives role and identity from the server, ignoring role and identity sent in the body', async () => {
  const { token: hostToken } = await h.makeUser();
  const { user: guest, token: guestToken } = await h.makeUser();
  const meeting = await h.makeMeeting(hostToken, 'Privilege escalation attempt');

  const res = await h.api(tokenPath(meeting.meetingId), {
    method: 'POST',
    token: guestToken,
    body: { role: 'HOST', identity: 'someone-else', name: 'Administrator' },
  });

  assert.equal(res.status, 200);
  // The body asked for HOST. The database says otherwise, and the database wins.
  assert.equal(res.body.data.role, 'PARTICIPANT');
  assert.equal(res.body.data.identity, String(guest._id));
  assert.equal(res.body.data.name, guest.fullName);
  assert.equal(res.body.data.meeting.isHost, false);

  // The same must hold for what was actually handed to LiveKit.
  const minted = callsFor('createParticipantToken', meeting.meetingId);
  assert.equal(minted.length, 1);
  assert.equal(minted[0][1].role, 'PARTICIPANT');
  assert.equal(minted[0][1].identity, String(guest._id));

  // ...and for the claims inside the minted token itself.
  const claims = decodePayload(res.body.data.token);
  assert.equal(claims.sub, String(guest._id));
  assert.equal(JSON.parse(claims.metadata).role, 'PARTICIPANT');
  // The token is scoped to this one room, not to the whole server.
  assert.equal(claims.video.room, meeting.meetingId);
  assert.equal(claims.video.roomAdmin, false);
});

// ============================================================
// Meeting lifecycle
// ============================================================

test('flips the meeting from CREATED to ACTIVE when the first token is requested', async () => {
  const { token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Lifecycle');
  assert.equal(meeting.status, 'CREATED');

  const res = await h.api(tokenPath(meeting.meetingId), { method: 'POST', token });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.meeting.status, 'ACTIVE');
  assert.ok(res.body.data.meeting.startedAt, 'startedAt should be stamped');

  // And it is persisted, not just reported.
  const lookup = await h.api(`/api/meetings/${meeting.meetingId}`, { token });
  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.data.meeting.status, 'ACTIVE');
});

test('returns 410 MEETING_ENDED to the host once the meeting has been ended', async () => {
  const { token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Ended for host');

  const ended = await h.api(`/api/meetings/${meeting.meetingId}/end`, { method: 'POST', token });
  assert.equal(ended.status, 200);
  assert.equal(ended.body.data.meeting.status, 'ENDED');

  const res = await h.api(tokenPath(meeting.meetingId), { method: 'POST', token });

  assert.equal(res.status, 410);
  assert.equal(res.body.code, 'MEETING_ENDED');
  // Nothing was provisioned or minted for a dead meeting.
  assert.equal(callsFor('ensureRoom', meeting.meetingId).length, 0);
  assert.equal(callsFor('createParticipantToken', meeting.meetingId).length, 0);
});

test('returns 410 MEETING_ENDED to a participant who arrives after the host ended it', async () => {
  const { token: hostToken } = await h.makeUser();
  const { token: guestToken } = await h.makeUser();
  const meeting = await h.makeMeeting(hostToken, 'Ended for guest');

  await h.api(`/api/meetings/${meeting.meetingId}/end`, { method: 'POST', token: hostToken });

  const res = await h.api(tokenPath(meeting.meetingId), { method: 'POST', token: guestToken });

  assert.equal(res.status, 410);
  assert.equal(res.body.code, 'MEETING_ENDED');
  assert.equal(callsFor('createParticipantToken', meeting.meetingId).length, 0);
});

// ============================================================
// Bans
// ============================================================

test('returns 403 PARTICIPANT_BANNED and mints no token once the host has banned that user', async () => {
  const { token: hostToken } = await h.makeUser();
  const { user: guest, token: guestToken } = await h.makeUser();
  const meeting = await h.makeMeeting(hostToken, 'Ban flow');

  // The guest gets in once...
  const before = await h.api(tokenPath(meeting.meetingId), { method: 'POST', token: guestToken });
  assert.equal(before.status, 200);
  const mintedBefore = callsFor('createParticipantToken', meeting.meetingId).length;

  // ...then the host removes them with a ban.
  const removed = await h.api(
    `/api/meetings/${meeting.meetingId}/participants/${String(guest._id)}?ban=true`,
    { method: 'DELETE', token: hostToken }
  );
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.banned, true);

  const after = await h.api(tokenPath(meeting.meetingId), { method: 'POST', token: guestToken });

  assert.equal(after.status, 403);
  assert.equal(after.body.code, 'PARTICIPANT_BANNED');
  // No second token was minted for the banned user.
  assert.equal(callsFor('createParticipantToken', meeting.meetingId).length, mintedBefore);
});

test('still lets the host in after banning someone else', async () => {
  const { user: host, token: hostToken } = await h.makeUser();
  const { user: guest, token: guestToken } = await h.makeUser();
  const meeting = await h.makeMeeting(hostToken, 'Ban does not lock out the host');

  await h.api(tokenPath(meeting.meetingId), { method: 'POST', token: guestToken });
  await h.api(
    `/api/meetings/${meeting.meetingId}/participants/${String(guest._id)}?ban=true`,
    { method: 'DELETE', token: hostToken }
  );

  const res = await h.api(tokenPath(meeting.meetingId), { method: 'POST', token: hostToken });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.role, 'HOST');
  assert.equal(res.body.data.identity, String(host._id));
});

// ============================================================
// Concurrency — the duplicate participant-history bug
// ============================================================

test('records each person once when ten token requests from two users arrive at the same time', async () => {
  const { token: hostToken } = await h.makeUser();
  const { token: guestToken } = await h.makeUser();
  const meeting = await h.makeMeeting(hostToken, 'Concurrent joins');

  // Five each, all in flight together: React StrictMode double-invokes the
  // join effect, users double-click Join, and refreshes re-request a token.
  const tokens = [hostToken, hostToken, hostToken, hostToken, hostToken,
    guestToken, guestToken, guestToken, guestToken, guestToken];

  const results = await Promise.all(
    tokens.map((token) => h.api(tokenPath(meeting.meetingId), { method: 'POST', token }))
  );

  for (const res of results) assert.equal(res.status, 200);
  assert.equal(results.filter((r) => r.body.data.role === 'HOST').length, 5);
  assert.equal(results.filter((r) => r.body.data.role === 'PARTICIPANT').length, 5);

  const lookup = await h.api(`/api/meetings/${meeting.meetingId}`, { token: hostToken });
  assert.equal(lookup.status, 200);
  assert.equal(
    lookup.body.data.meeting.participantCount,
    2,
    'participant history must hold one row per person, not one per request'
  );
});
