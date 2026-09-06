/**
 * ============================================================
 * Meetings — Host Controls
 * ============================================================
 * Covers the four host-only endpoints and, just as importantly,
 * what happens when someone who is NOT the host calls them:
 *
 *   POST   /api/meetings/:id/end
 *   DELETE /api/meetings/:id/participants/:identity[?ban=true]
 *   POST   /api/meetings/:id/participants/:identity/mute
 *   PATCH  /api/meetings/:id
 *
 * Host authority comes from Meeting.hostId alone, so the negative
 * cases use a fully signed-in user who has genuinely joined the
 * meeting: the point is that being a participant grants nothing.
 *
 * LiveKit is stubbed, so "the room was torn down" is asserted by
 * looking at the calls the server tried to make, not by a network
 * round trip.
 * ============================================================
 */

const test = require('node:test');
const assert = require('node:assert/strict');
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

// ============================================================
// Local helpers
// ============================================================

/** Assert the status code, showing the response body when it does not match. */
const expectStatus = (res, status) =>
  assert.equal(res.status, status, `unexpected status — body was ${JSON.stringify(res.body)}`);

/** A freshly created host plus the meeting they own. */
async function hostWithMeeting(title = 'Host controls') {
  const host = await h.makeUser();
  const meeting = await h.makeMeeting(host.token, title);
  return { host, meeting };
}

/** Ask for a LiveKit token — this is the join path and the only join gate. */
const requestToken = (token, meetingId) =>
  h.api(`/api/meetings/${meetingId}/token`, { method: 'POST', token });

const fetchMeeting = (token, meetingId) => h.api(`/api/meetings/${meetingId}`, { token });

/** Join as the host and return the room name the server minted the token for. */
async function joinAsHost(host, meeting) {
  const res = await requestToken(host.token, meeting.meetingId);
  expectStatus(res, 200);
  return res.body.data.roomName;
}

/** Every stubbed LiveKit call of `method` that targeted `roomName`. */
const lkCalls = (method, roomName) => lk.calls.filter((c) => c[0] === method && c[1] === roomName);

// ============================================================
// POST /:id/end
// ============================================================

test('a joined participant cannot end the meeting and is told they are not the host', async () => {
  const { host, meeting } = await hostWithMeeting();
  const guest = await h.makeUser();
  expectStatus(await requestToken(guest.token, meeting.meetingId), 200);

  const res = await h.api(`/api/meetings/${meeting.meetingId}/end`, {
    method: 'POST',
    token: guest.token,
  });

  expectStatus(res, 403);
  assert.equal(res.body.code, 'NOT_HOST');

  // The refusal must be real, not just a status code: the meeting is untouched.
  const after = await fetchMeeting(host.token, meeting.meetingId);
  expectStatus(after, 200);
  assert.equal(after.body.data.meeting.status, 'ACTIVE');
});

test('the host ends the meeting, which becomes ENDED and tears down the LiveKit room', async () => {
  const { host, meeting } = await hostWithMeeting();
  const roomName = await joinAsHost(host, meeting);

  const res = await h.api(`/api/meetings/${meeting.meetingId}/end`, {
    method: 'POST',
    token: host.token,
  });

  expectStatus(res, 200);
  assert.equal(res.body.data.meeting.status, 'ENDED');
  assert.equal(lkCalls('deleteRoom', roomName).length, 1);
});

test('ending an already ended meeting succeeds without deleting the room a second time', async () => {
  const { host, meeting } = await hostWithMeeting();
  const roomName = await joinAsHost(host, meeting);
  const endUrl = `/api/meetings/${meeting.meetingId}/end`;

  expectStatus(await h.api(endUrl, { method: 'POST', token: host.token }), 200);

  const second = await h.api(endUrl, { method: 'POST', token: host.token });
  expectStatus(second, 200);
  assert.equal(second.body.data.meeting.status, 'ENDED');
  assert.equal(lkCalls('deleteRoom', roomName).length, 1);
});

// ============================================================
// DELETE /:id/participants/:identity
// ============================================================

test('a joined participant cannot remove anyone from the meeting', async () => {
  const { meeting } = await hostWithMeeting();
  const guest = await h.makeUser();
  const target = await h.makeUser();
  expectStatus(await requestToken(guest.token, meeting.meetingId), 200);

  const res = await h.api(`/api/meetings/${meeting.meetingId}/participants/${target.user._id}`, {
    method: 'DELETE',
    token: guest.token,
  });

  expectStatus(res, 403);
  assert.equal(res.body.code, 'NOT_HOST');
});

test('the host cannot remove themselves from their own meeting', async () => {
  const { host, meeting } = await hostWithMeeting();

  const res = await h.api(`/api/meetings/${meeting.meetingId}/participants/${host.user._id}`, {
    method: 'DELETE',
    token: host.token,
  });

  expectStatus(res, 400);
  assert.equal(res.body.code, 'CANNOT_REMOVE_SELF');
});

test('a participant removed without a ban is disconnected but can still get a token', async () => {
  const { host, meeting } = await hostWithMeeting();
  const guest = await h.makeUser();
  const identity = String(guest.user._id);

  const roomName = await joinAsHost(host, meeting);
  expectStatus(await requestToken(guest.token, meeting.meetingId), 200);

  const res = await h.api(`/api/meetings/${meeting.meetingId}/participants/${identity}`, {
    method: 'DELETE',
    token: host.token,
  });

  expectStatus(res, 200);
  assert.equal(res.body.data.removed, true);
  assert.equal(res.body.data.banned, false);
  assert.equal(res.body.data.disconnected, true);

  // The server asked the media layer to disconnect exactly that identity.
  assert.deepEqual(
    lkCalls('removeParticipant', roomName).map((c) => c[2]),
    [identity]
  );

  // No ban was recorded, so the door is still open.
  expectStatus(await requestToken(guest.token, meeting.meetingId), 200);
});

test('a participant removed with ban=true is refused a token from then on', async () => {
  const { host, meeting } = await hostWithMeeting();
  const guest = await h.makeUser();
  const identity = String(guest.user._id);

  // They could join a moment ago...
  expectStatus(await requestToken(guest.token, meeting.meetingId), 200);

  const res = await h.api(`/api/meetings/${meeting.meetingId}/participants/${identity}?ban=true`, {
    method: 'DELETE',
    token: host.token,
  });

  expectStatus(res, 200);
  assert.equal(res.body.data.removed, true);
  assert.equal(res.body.data.banned, true);

  // ...and now the join gate refuses them.
  const after = await requestToken(guest.token, meeting.meetingId);
  expectStatus(after, 403);
  assert.equal(after.body.code, 'PARTICIPANT_BANNED');
});

// ============================================================
// POST /:id/participants/:identity/mute
// ============================================================

test('a joined participant cannot mute another participant', async () => {
  const { meeting } = await hostWithMeeting();
  const guest = await h.makeUser();
  const target = await h.makeUser();
  expectStatus(await requestToken(guest.token, meeting.meetingId), 200);

  const res = await h.api(
    `/api/meetings/${meeting.meetingId}/participants/${target.user._id}/mute`,
    { method: 'POST', token: guest.token, body: { source: 'microphone' } }
  );

  expectStatus(res, 403);
  assert.equal(res.body.code, 'NOT_HOST');
});

test('the host cannot mute a track source the API does not know about', async () => {
  const { host, meeting } = await hostWithMeeting();
  const target = await h.makeUser();
  const identity = String(target.user._id);

  const res = await h.api(`/api/meetings/${meeting.meetingId}/participants/${identity}/mute`, {
    method: 'POST',
    token: host.token,
    body: { source: 'screenshare' },
  });

  expectStatus(res, 422);
  assert.equal(res.body.code, 'VALIDATION_FAILED');

  // Rejected before anything reached the media server.
  assert.equal(lk.calls.filter((c) => c[0] === 'muteTrack' && c[2] === identity).length, 0);
});

test('the host muting a camera records a camera mute for that participant', async () => {
  const { host, meeting } = await hostWithMeeting();
  const target = await h.makeUser();
  const identity = String(target.user._id);

  const roomName = await joinAsHost(host, meeting);
  lk.addParticipant(roomName, identity, [{ source: 'camera' }]);

  const res = await h.api(`/api/meetings/${meeting.meetingId}/participants/${identity}/mute`, {
    method: 'POST',
    token: host.token,
    body: { source: 'camera' },
  });

  expectStatus(res, 200);
  assert.equal(res.body.data.muted, true);
  assert.equal(res.body.data.source, 'camera');
  assert.deepEqual(lkCalls('muteTrack', roomName), [['muteTrack', roomName, identity, 'camera']]);
});

test('a mute request with no source given falls back to the microphone', async () => {
  const { host, meeting } = await hostWithMeeting();
  const target = await h.makeUser();
  const identity = String(target.user._id);

  const roomName = await joinAsHost(host, meeting);
  lk.addParticipant(roomName, identity, [{ source: 'microphone' }]);

  const res = await h.api(`/api/meetings/${meeting.meetingId}/participants/${identity}/mute`, {
    method: 'POST',
    token: host.token,
    body: {},
  });

  expectStatus(res, 200);
  assert.equal(res.body.data.source, 'microphone');
  assert.deepEqual(lkCalls('muteTrack', roomName), [
    ['muteTrack', roomName, identity, 'microphone'],
  ]);
});

// ============================================================
// PATCH /:id
// ============================================================

test('a joined participant cannot rename or lock the meeting', async () => {
  const { host, meeting } = await hostWithMeeting('Weekly sync');
  const guest = await h.makeUser();
  expectStatus(await requestToken(guest.token, meeting.meetingId), 200);

  const res = await h.api(`/api/meetings/${meeting.meetingId}`, {
    method: 'PATCH',
    token: guest.token,
    body: { title: 'Hijacked', locked: true },
  });

  expectStatus(res, 403);
  assert.equal(res.body.code, 'NOT_HOST');

  const after = await fetchMeeting(host.token, meeting.meetingId);
  expectStatus(after, 200);
  assert.equal(after.body.data.meeting.title, 'Weekly sync');
  assert.equal(after.body.data.meeting.locked, false);
});

test('the host can rename the meeting', async () => {
  const { host, meeting } = await hostWithMeeting('Original title');

  const res = await h.api(`/api/meetings/${meeting.meetingId}`, {
    method: 'PATCH',
    token: host.token,
    body: { title: 'Sprint retro' },
  });

  expectStatus(res, 200);
  assert.equal(res.body.data.meeting.title, 'Sprint retro');
  // A rename must not quietly change anything else.
  assert.equal(res.body.data.meeting.locked, false);
  assert.equal(res.body.data.meeting.meetingId, meeting.meetingId);
});

test('locking the meeting keeps non-hosts out while the host can still join', async () => {
  const { host, meeting } = await hostWithMeeting();
  const guest = await h.makeUser();

  const patched = await h.api(`/api/meetings/${meeting.meetingId}`, {
    method: 'PATCH',
    token: host.token,
    body: { locked: true },
  });
  expectStatus(patched, 200);
  assert.equal(patched.body.data.meeting.locked, true);

  const refused = await requestToken(guest.token, meeting.meetingId);
  expectStatus(refused, 423);
  assert.equal(refused.body.code, 'MEETING_LOCKED');

  const allowed = await requestToken(host.token, meeting.meetingId);
  expectStatus(allowed, 200);
  assert.equal(allowed.body.data.role, 'HOST');
});
