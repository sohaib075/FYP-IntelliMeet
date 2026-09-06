/**
 * ============================================================
 * Meetings — create & list (CRUD)
 * ============================================================
 * Covers POST /api/meetings and GET /api/meetings through the real
 * middleware chain: auth -> validators -> controller -> Mongo.
 *
 * LiveKit is stubbed, so nothing here touches the network. Every
 * assertion is scoped to fixtures this file created, so the suite is
 * safe to run against a shared development database.
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

/** Public meeting codes look like abc-defg-hij. */
const MEETING_ID = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

const create = (token, body) => h.api('/api/meetings', { method: 'POST', token, body });
const list = (token, qs = '') => h.api(`/api/meetings${qs}`, { token });

/** Small gap so createdAt differs; "newest first" is otherwise a coin toss. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 25));

// ============================================================
// Authentication
// ============================================================

test('creating a meeting without a token is refused as unauthenticated', async () => {
  const res = await create(null, { title: 'Anonymous attempt' });
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
  assert.equal(res.body.success, false);
  assert.equal(res.body.data, undefined, 'no meeting payload may leak on a 401');
});

test('listing meetings without a token is refused as unauthenticated', async () => {
  const res = await list(null);
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
});

test('a token that is not a valid JWT is refused', async () => {
  const res = await create('not-a-real-jwt', { title: 'Forged' });
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
});

// ============================================================
// Creating
// ============================================================

test('creating a meeting returns 201 with a well-formed id, CREATED status, isHost and a url', async () => {
  const { user, token } = await h.makeUser({ fullName: 'Ada Lovelace' });

  const res = await create(token, { title: 'Sprint planning' });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);

  const meeting = res.body.data.meeting;
  assert.match(meeting.meetingId, MEETING_ID);
  assert.equal(meeting.title, 'Sprint planning');
  assert.equal(meeting.status, 'CREATED');
  assert.equal(meeting.isHost, true, 'the creator is always the host');
  assert.equal(meeting.locked, false);
  assert.equal(meeting.participantCount, 0, 'nobody has joined a freshly created meeting');
  assert.equal(meeting.startedAt, null);
  assert.equal(meeting.endedAt, null);

  assert.equal(meeting.host.id, String(user._id));
  assert.equal(meeting.host.name, 'Ada Lovelace');

  assert.equal(typeof meeting.url, 'string');
  assert.ok(meeting.url.startsWith('http'), `url should be absolute, got ${meeting.url}`);
  assert.ok(
    meeting.url.endsWith(`/meet/${meeting.meetingId}`),
    `url should end with the meeting code, got ${meeting.url}`
  );
});

test('creating a meeting does not touch the media server', async () => {
  const before = lk.calls.length;
  const { token } = await h.makeUser();

  const res = await create(token, { title: 'No room yet' });

  assert.equal(res.status, 201);
  assert.equal(
    lk.calls.length,
    before,
    'a room is only allocated when someone asks for a join token'
  );
});

test('a title longer than 100 characters is rejected as a validation failure', async () => {
  const { token } = await h.makeUser();

  const res = await create(token, { title: 'x'.repeat(101) });

  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'VALIDATION_FAILED');
  assert.ok(Array.isArray(res.body.errors));
  assert.ok(
    res.body.errors.some((e) => e.field === 'title'),
    'the failure should name the offending field'
  );
});

test('a title of exactly 100 characters is accepted', async () => {
  const { token } = await h.makeUser();
  const title = 'y'.repeat(100);

  const res = await create(token, { title });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.meeting.title, title);
});

test('a title is trimmed before it is stored', async () => {
  const { token } = await h.makeUser();

  const res = await create(token, { title: '   Design review   ' });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.meeting.title, 'Design review');
});

test('omitting the title falls back to a sensible default rather than failing', async () => {
  const { token } = await h.makeUser();

  const res = await create(token, {});

  assert.equal(res.status, 201);
  const { title } = res.body.data.meeting;
  assert.equal(typeof title, 'string');
  assert.ok(title.trim().length > 0, 'the default title must not be blank');
  assert.ok(title.length <= 100);
});

test('a blank title is treated as missing, not as a validation failure', async () => {
  const { token } = await h.makeUser();

  const blank = await create(token, { title: '   ' });
  const empty = await create(token, { title: '' });

  assert.equal(blank.status, 201);
  assert.equal(empty.status, 201);
  assert.ok(blank.body.data.meeting.title.trim().length > 0);
  assert.equal(blank.body.data.meeting.title, empty.body.data.meeting.title);
});

test('a scheduledFor that is not an ISO-8601 date is rejected', async () => {
  const { token } = await h.makeUser();

  const res = await create(token, { title: 'Bad date', scheduledFor: 'next tuesday' });

  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'VALIDATION_FAILED');
  assert.ok(res.body.errors.some((e) => e.field === 'scheduledFor'));
});

test('an ISO-8601 scheduledFor is stored and returned', async () => {
  const { token } = await h.makeUser();
  const when = '2030-01-15T09:30:00.000Z';

  const res = await create(token, { title: 'Kickoff', scheduledFor: when });

  assert.equal(res.status, 201);
  assert.equal(new Date(res.body.data.meeting.scheduledFor).toISOString(), when);
  assert.equal(res.body.data.meeting.status, 'CREATED', 'scheduling does not start a meeting');
});

// ============================================================
// Regression: a stale unique index once capped the collection at one document
// ============================================================

test('creating several meetings in a row all succeed with distinct ids', async () => {
  const { token } = await h.makeUser();

  const created = [];
  for (let i = 0; i < 6; i += 1) {
    const res = await create(token, { title: `Standup ${i}` });
    assert.equal(
      res.status,
      201,
      `meeting ${i + 1} of 6 failed: ${res.status} ${JSON.stringify(res.body)} ` +
        '(a stale unique index on the meetings collection would cap it at one document)'
    );
    created.push(res.body.data.meeting.meetingId);
  }

  created.forEach((id) => assert.match(id, MEETING_ID));
  assert.equal(new Set(created).size, created.length, 'every meeting id must be distinct');

  const res = await list(token);
  assert.equal(res.status, 200);
  const listed = res.body.data.meetings.map((m) => m.meetingId);
  created.forEach((id) => assert.ok(listed.includes(id), `${id} is missing from the host's list`));
});

// ============================================================
// Listing
// ============================================================

test('listing returns the meetings the caller hosts, newest first', async () => {
  const { token } = await h.makeUser();

  const first = await h.makeMeeting(token, 'Oldest');
  await tick();
  const second = await h.makeMeeting(token, 'Middle');
  await tick();
  const third = await h.makeMeeting(token, 'Newest');

  const res = await list(token);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const meetings = res.body.data.meetings;
  assert.ok(Array.isArray(meetings));
  assert.equal(meetings.length, 3, 'a fresh user sees exactly the meetings they created');
  assert.deepEqual(
    meetings.map((m) => m.meetingId),
    [third.meetingId, second.meetingId, first.meetingId]
  );

  const timestamps = meetings.map((m) => new Date(m.createdAt).getTime());
  for (let i = 1; i < timestamps.length; i += 1) {
    assert.ok(timestamps[i - 1] >= timestamps[i], 'createdAt must be non-increasing');
  }
});

test('every listed meeting carries the host flag and a join url', async () => {
  const { user, token } = await h.makeUser({ fullName: 'Grace Hopper' });
  await h.makeMeeting(token, 'Mine');

  const res = await list(token);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.meetings.length, 1);
  const meeting = res.body.data.meetings[0];
  assert.equal(meeting.isHost, true);
  assert.equal(meeting.host.id, String(user._id));
  assert.equal(meeting.host.name, 'Grace Hopper');
  assert.ok(meeting.url.endsWith(`/meet/${meeting.meetingId}`));
});

test("listing never includes another user's meeting the caller has not joined", async () => {
  const alice = await h.makeUser();
  const bob = await h.makeUser();

  const bobsMeeting = await h.makeMeeting(bob.token, "Bob's private sync");
  const alicesMeeting = await h.makeMeeting(alice.token, "Alice's own sync");

  const res = await list(alice.token);

  assert.equal(res.status, 200);
  const ids = res.body.data.meetings.map((m) => m.meetingId);
  assert.ok(ids.includes(alicesMeeting.meetingId));
  assert.ok(
    !ids.includes(bobsMeeting.meetingId),
    "a meeting the caller neither hosts nor joined must not appear in their list"
  );
});

test('a new user with no meetings gets an empty list rather than an error', async () => {
  const { token } = await h.makeUser();

  const res = await list(token);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.meetings, []);
});

test('listing can be filtered by status', async () => {
  const { token } = await h.makeUser();
  await h.makeMeeting(token, 'Still just created');

  const created = await list(token, '?status=CREATED');
  const ended = await list(token, '?status=ENDED');

  assert.equal(created.status, 200);
  assert.equal(created.body.data.meetings.length, 1);
  assert.equal(created.body.data.meetings[0].status, 'CREATED');

  assert.equal(ended.status, 200);
  assert.deepEqual(ended.body.data.meetings, []);
});

test('an unknown status filter is rejected as a validation failure', async () => {
  const { token } = await h.makeUser();

  const res = await list(token, '?status=BANANA');

  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'VALIDATION_FAILED');
  assert.ok(res.body.errors.some((e) => e.field === 'status'));
});
