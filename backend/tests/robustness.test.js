/**
 * ============================================================
 * Malformed input must never reach the controllers
 * ============================================================
 * Every case here produced a 500 before it was fixed. They are all
 * trivially reachable by anyone who can send JSON, including the
 * unauthenticated login route, so each one is a regression guard
 * rather than a hypothetical.
 *
 * Two root causes are covered:
 *
 * 1. express-validator coerces values for VALIDATION but leaves
 *    req.body untouched, so a JSON array or object passed the checks
 *    and then crashed the controller (`email.toLowerCase is not a
 *    function`, `title.trim is not a function`, bcrypt's "Illegal
 *    arguments"). Fixed by putting isString() first in every chain.
 *
 * 2. http-errors keeps `status`/`statusCode` NON-ENUMERABLE, so the
 *    error handler's `{...err}` copy lost them and body-parser
 *    failures surfaced as 500 instead of 413/400.
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
// Non-string values where a string is expected
// ============================================================

test('login rejects a non-string email instead of crashing on toLowerCase', async () => {
  for (const email of [['a@b.com'], { a: 1 }, 42, true]) {
    const res = await h.api('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'whatever' },
    });
    assert.equal(res.status, 422, `email ${JSON.stringify(email)} should be a validation error`);
    assert.equal(res.body.code, 'VALIDATION_FAILED');
  }
});

test('login rejects a non-string password instead of crashing bcrypt', async () => {
  const res = await h.api('/api/auth/login', {
    method: 'POST',
    body: { email: 'someone@test.invalid', password: ['x'] },
  });
  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'VALIDATION_FAILED');
});

test('a wrong password is still a clean 401, not a validation error', async () => {
  // Guards against the isString() fix over-reaching and turning genuine
  // credential failures into 422s.
  const { email } = await h.makeUser();
  const res = await h.api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'DefinitelyNotTheRightOne1!' },
  });
  assert.equal(res.status, 401);
  assert.notEqual(res.body.code, 'VALIDATION_FAILED');
});

test('creating a meeting rejects a non-string title rather than storing junk', async () => {
  const { token } = await h.makeUser();

  // An object used to be stored as the literal string "[object Object]",
  // and an array used to crash the controller on title.trim().
  for (const title of [{ $ne: 1 }, ['a', 'b'], 42, true]) {
    const res = await h.api('/api/meetings', { method: 'POST', token, body: { title } });
    assert.equal(res.status, 422, `title ${JSON.stringify(title)} should be a validation error`);
    assert.equal(res.body.code, 'VALIDATION_FAILED');
  }

  // A real title still works, and an absent one still gets the default.
  const ok = await h.api('/api/meetings', { method: 'POST', token, body: { title: 'A real title' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.meeting.title, 'A real title');

  const missing = await h.api('/api/meetings', { method: 'POST', token, body: {} });
  assert.equal(missing.status, 201);
  assert.ok(missing.body.data.meeting.title.length > 0);
});

test('profile, preferences and password updates reject non-string fields', async () => {
  const { token } = await h.makeUser();

  const cases = [
    ['PUT', '/api/users/profile', { fullName: ['a'] }],
    ['PUT', '/api/users/profile', { phoneNumber: ['1'] }],
    ['PATCH', '/api/users/preferences', { spokenLanguage: ['en'] }],
    ['PUT', '/api/users/password', { currentPassword: [], newPassword: [] }],
  ];

  for (const [method, path, body] of cases) {
    const res = await h.api(path, { method, token, body });
    assert.equal(res.status, 422, `${method} ${path} with ${JSON.stringify(body)}`);
    assert.equal(res.body.code, 'VALIDATION_FAILED');
  }
});

// ============================================================
// Unreadable request bodies
// ============================================================

test('a body over the size limit is a 413, not a server error', async () => {
  const { token } = await h.makeUser();
  const res = await h.api('/api/meetings', {
    method: 'POST',
    token,
    body: JSON.stringify({ title: 'x'.repeat(50_000) }),
  });
  assert.equal(res.status, 413);
  assert.equal(res.body.code, 'PAYLOAD_TOO_LARGE');
  // The raw body-parser wording must not reach the user.
  assert.doesNotMatch(String(res.body.message), /request entity too large/i);
});

test('a body that is not valid JSON is a 400, not a server error', async () => {
  const { token } = await h.makeUser();
  const res = await h.api('/api/meetings', {
    method: 'POST',
    token,
    body: '{ this is not json',
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_JSON');
});

// ============================================================
// Nothing anywhere should 500 on hostile input
// ============================================================

test('no endpoint returns a 5xx for malformed input', async () => {
  const { token } = await h.makeUser();

  const probes = [
    ['POST', '/api/auth/login', { email: {}, password: {} }, null],
    ['POST', '/api/auth/register', { fullName: [], email: [], password: [] }, null],
    ['POST', '/api/auth/forgot-password', { email: [] }, null],
    ['POST', '/api/auth/reset-password', { password: [], token: [] }, null],
    ['POST', '/api/auth/verify-otp', { email: [], otp: [] }, null],
    ['POST', '/api/meetings', { title: [], scheduledFor: [] }, token],
    ['PATCH', '/api/meetings/abc-defg-hij', { title: [], locked: [] }, token],
    ['PUT', '/api/users/profile', { fullName: {}, email: {}, phoneNumber: {} }, token],
    ['PATCH', '/api/users/preferences', { spokenLanguage: {}, listeningLanguage: {} }, token],
  ];

  const failures = [];
  for (const [method, path, body, tok] of probes) {
    const res = await h.api(path, { method, token: tok, body });
    if (res.status >= 500) failures.push(`${method} ${path} -> ${res.status} ${res.body?.message ?? ''}`);
  }

  assert.deepEqual(failures, [], `these endpoints crashed on malformed input:\n${failures.join('\n')}`);
});
