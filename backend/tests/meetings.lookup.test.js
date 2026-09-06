/**
 * ============================================================
 * GET /api/meetings/:meetingId — the validation gate
 * ============================================================
 * This endpoint is what the "enter a code" box on the landing page calls.
 * It has one job: say whether a code is nonsense, unknown, or a real
 * meeting — WITHOUT bringing anything into existence. A lookup that
 * created a room (or a Meeting row) would mean any stranger could
 * conjure meetings by typing random codes, so "creates nothing" is
 * asserted here rather than assumed.
 *
 * Everything is scoped to fixtures this file creates: counts are taken
 * per-host, never globally, so this file can run beside the others.
 * ============================================================
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const Meeting = require('../models/Meeting');

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

/** Path-safe URL for a raw, possibly ugly, user-typed code. */
const lookupPath = (raw) => `/api/meetings/${encodeURIComponent(raw)}`;

/** How many times the server asked LiveKit to bring a room into being. */
const ensureRoomCalls = () => lk.calls.filter((c) => c[0] === 'ensureRoom').length;

/**
 * A code that is definitely well-formed and definitely absent: mint a real
 * one through the API, then remove the row. Using a fixture we created
 * ourselves keeps this independent of whatever else is in the database.
 */
async function vacantCode(token) {
  const meeting = await h.makeMeeting(token, 'Deleted on purpose');
  await Meeting.deleteOne({ meetingId: meeting.meetingId });
  return meeting.meetingId;
}

// ============================================================
// Unknown vs. malformed — the two failure modes must stay distinct
// ============================================================

test('a well-formed code that belongs to no meeting is 404 MEETING_NOT_FOUND', async () => {
  const { token } = await h.makeUser();
  const missing = await vacantCode(token);

  const res = await h.api(lookupPath(missing), { token });

  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'MEETING_NOT_FOUND');
  assert.equal(res.body.success, false);
});

test('a malformed code such as random123 is 400 INVALID_MEETING_ID, not a 404', async () => {
  const { token } = await h.makeUser();

  const res = await h.api(lookupPath('random123'), { token });

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_MEETING_ID');
});

test('codes with the wrong number of letters are malformed rather than merely missing', async () => {
  const { token } = await h.makeUser();

  // None of these contain an embedded abc-defg-hij pattern, so each one
  // should be turned away by the format check before any database read.
  const nonsense = ['abc-def-ghi', 'abcdefghijk', '123-4567-890', 'the-quick-brown'];

  for (const raw of nonsense) {
    const res = await h.api(lookupPath(raw), { token });
    assert.equal(res.status, 400, `expected 400 for ${raw}, got ${res.status}`);
    assert.equal(res.body.code, 'INVALID_MEETING_ID', `wrong code for ${raw}`);
  }
});

test('the id format is only checked after authentication, so an anonymous caller gets 401', async () => {
  const res = await h.api(lookupPath('random123'));

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
});

// ============================================================
// Normalisation — the same meeting, however it was typed
// ============================================================

test('a code typed in capitals with spaces resolves to the same meeting', async () => {
  const { token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Casing and spacing');

  const typed = meeting.meetingId.replace(/-/g, ' ').toUpperCase(); // 'ABC DEFG HIJ'
  assert.notEqual(typed, meeting.meetingId); // the input really is different

  const res = await h.api(lookupPath(typed), { token });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.meeting.meetingId, meeting.meetingId);
  assert.equal(res.body.data.meeting.title, 'Casing and spacing');
});

test('a code typed with no separators at all resolves to the same meeting', async () => {
  const { token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'No separators');

  const res = await h.api(lookupPath(meeting.meetingId.replace(/-/g, '')), { token });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.meeting.meetingId, meeting.meetingId);
});

test('a pasted meeting link is accepted, not treated as a malformed code', async () => {
  const { token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Pasted link');

  const res = await h.api(lookupPath(`https://intellimeet.example/meet/${meeting.meetingId}`), {
    token,
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.meeting.meetingId, meeting.meetingId);
});

// ============================================================
// Looking is not touching
// ============================================================

test('looking up a meeting creates nothing: no LiveKit room and no new meeting row', async () => {
  const { user, token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Read only');
  const missing = await vacantCode(token);

  const roomsBefore = ensureRoomCalls();
  const callsBefore = lk.calls.length;
  const rowsBefore = await Meeting.countDocuments({ hostId: user._id });

  const found = await h.api(lookupPath(meeting.meetingId), { token });
  const absent = await h.api(lookupPath(missing), { token });
  const bad = await h.api(lookupPath('random123'), { token });

  assert.equal(found.status, 200);
  assert.equal(absent.status, 404);
  assert.equal(bad.status, 400);

  // The media server was never asked for anything at all.
  assert.equal(ensureRoomCalls(), roomsBefore, 'lookup must not create a LiveKit room');
  assert.equal(lk.calls.length, callsBefore, 'lookup must not touch LiveKit at all');

  // No row appeared, and specifically not one for the code that missed.
  assert.equal(await Meeting.countDocuments({ hostId: user._id }), rowsBefore);
  assert.equal(await Meeting.exists({ meetingId: missing }), null);

  // Looking at a fresh meeting must not start it either.
  assert.equal(found.body.data.meeting.status, 'CREATED');
  assert.equal(found.body.data.meeting.participantCount, 0);
});

// ============================================================
// Who is asking, and what state is it in
// ============================================================

test('a non-host who looks up a meeting sees isHost false and the real host name', async () => {
  const { user: host, token: hostToken } = await h.makeUser({ fullName: 'Hosting Hannah' });
  const { token: guestToken } = await h.makeUser({ fullName: 'Guest Greg' });
  const meeting = await h.makeMeeting(hostToken, 'Someone else’s meeting');

  const asGuest = await h.api(lookupPath(meeting.meetingId), { token: guestToken });
  const asHost = await h.api(lookupPath(meeting.meetingId), { token: hostToken });

  assert.equal(asGuest.status, 200);
  assert.equal(asGuest.body.data.meeting.isHost, false);
  assert.equal(asGuest.body.data.meeting.host.name, 'Hosting Hannah');
  assert.equal(asGuest.body.data.meeting.host.id, String(host._id));

  // Same meeting, same fields — only the viewer-dependent flag differs.
  assert.equal(asHost.body.data.meeting.isHost, true);
  assert.equal(asHost.body.data.meeting.meetingId, asGuest.body.data.meeting.meetingId);
});

test('an ended meeting still returns 200 with status ENDED so the lobby can explain', async () => {
  const { token: hostToken } = await h.makeUser();
  const { token: guestToken } = await h.makeUser();
  const meeting = await h.makeMeeting(hostToken, 'Already over');

  const ended = await h.api(`/api/meetings/${meeting.meetingId}/end`, {
    method: 'POST',
    token: hostToken,
  });
  assert.equal(ended.status, 200);

  for (const [who, token] of [['host', hostToken], ['guest', guestToken]]) {
    const res = await h.api(lookupPath(meeting.meetingId), { token });

    // 200, not 404 and not 410 — the caller needs to be told *why* it is over.
    assert.equal(res.status, 200, `${who} should still be able to look it up`);
    assert.equal(res.body.data.meeting.status, 'ENDED');
    assert.notEqual(res.body.data.meeting.endedAt, null);
  }
});
