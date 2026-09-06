/**
 * ============================================================
 * Authentication & Route Protection — behaviour tests
 * ============================================================
 * Covers the security-critical half of the auth surface:
 *
 *   - login succeeds and never leaks the password hash
 *   - login failures are indistinguishable (no user enumeration)
 *   - `protect` rejects missing / malformed / forged tokens
 *   - registration input validation (422 VALIDATION_FAILED)
 *   - registration against an already-verified email (409)
 *   - GET  /api/users/profile     returns the *caller's* profile
 *   - PATCH /api/users/preferences actually persists
 *
 * Budget note: this file makes exactly 6 requests to /api/auth/*.
 * The auth limiter allows 10 per 15 minutes outside development,
 * so the file stays comfortably under the cap and never trips it.
 * ============================================================
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const h = require('./helpers');
const config = require('../config/environment');

/** Password every fixture user is created with (see helpers.makeUser). */
const FIXTURE_PASSWORD = 'TestPass1!';

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
// Login
// ============================================================

test('login with correct credentials returns a token and a user without a password field', async () => {
  const { user, email } = await h.makeUser();

  const res = await h.api('/api/auth/login', {
    method: 'POST',
    body: { email, password: FIXTURE_PASSWORD },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const { token, user: returned } = res.body.data;

  // The token must be a real JWT for THIS user, signed with the server secret.
  assert.equal(typeof token, 'string');
  const decoded = jwt.verify(token, config.JWT_SECRET);
  assert.equal(decoded.id, String(user._id));

  // The caller gets their own identity back...
  assert.equal(returned.email, email);
  assert.equal(String(returned._id), String(user._id));

  // ...but never any secret material.
  assert.equal(returned.password, undefined);
  assert.equal(returned.resetPasswordToken, undefined);
  assert.equal(returned.resetPasswordExpire, undefined);

  // Belt and braces: neither the hash nor the plaintext appears anywhere
  // in the serialised response body.
  const raw = JSON.stringify(res.body);
  assert.ok(!raw.includes(FIXTURE_PASSWORD), 'plaintext password leaked in response');
  assert.ok(!raw.includes('$2a$') && !raw.includes('$2b$'), 'bcrypt hash leaked in response');
});

test('login with a wrong password and login with an unknown email fail identically, so accounts cannot be enumerated', async () => {
  const { email } = await h.makeUser();
  const unknownEmail = `nobody-${process.pid}-${Math.random().toString(36).slice(2, 8)}${h.TEST_EMAIL_SUFFIX}`;

  const wrongPassword = await h.api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'NotThePassword1!' },
  });

  const unknownUser = await h.api('/api/auth/login', {
    method: 'POST',
    body: { email: unknownEmail, password: FIXTURE_PASSWORD },
  });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownUser.status, 401);

  // The two responses must be indistinguishable: same code, same wording.
  // Compared against each other rather than a hard-coded string, so the
  // guarantee survives a reworded message.
  assert.equal(wrongPassword.body.code, unknownUser.body.code);
  assert.equal(wrongPassword.body.message, unknownUser.body.message);

  // A failed password must NOT be reported as a session problem — that code
  // is what tells the frontend to log the user out.
  assert.notEqual(wrongPassword.body.code, 'TOKEN_INVALID');

  // And no response may hint at which half of the credentials was wrong.
  for (const res of [wrongPassword, unknownUser]) {
    assert.equal(res.body.data, undefined);
    assert.ok(
      !/not\s*found|no\s*such|does\s*not\s*exist|unregistered/i.test(res.body.message),
      `message hints the account does not exist: ${res.body.message}`
    );
  }
});

// ============================================================
// Route protection
// ============================================================

test('a protected route rejects a request with no token', async () => {
  const res = await h.api('/api/users/profile');

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
  assert.equal(res.body.success, false);
});

test('a protected route rejects a malformed token', async () => {
  const res = await h.api('/api/users/profile', { token: 'this.is.not-a-jwt' });

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
});

test('a protected route rejects a token signed with the wrong secret', async () => {
  const { user } = await h.makeUser();

  // Same payload shape a genuine token has — only the signature differs.
  const forged = jwt.sign({ id: String(user._id) }, 'definitely-not-the-server-secret', {
    expiresIn: '1h',
  });

  const res = await h.api('/api/users/profile', { token: forged });

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
  assert.equal(res.body.data, undefined);
});

// ============================================================
// Registration validation
// ============================================================

test('registration is rejected with 422 when the password is too weak', async () => {
  const res = await h.api('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'Weak Password User',
      email: `weak-${process.pid}${h.TEST_EMAIL_SUFFIX}`,
      password: 'password', // no uppercase, no digit, no special character
    },
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'VALIDATION_FAILED');
  assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
  assert.ok(
    res.body.errors.some((e) => e.field === 'password'),
    'expected at least one error against the password field'
  );
});

test('registration is rejected with 422 when the email is not a valid address', async () => {
  const res = await h.api('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'Bad Email User',
      email: 'not-an-email',
      password: 'ValidPass1!',
    },
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'VALIDATION_FAILED');
  assert.ok(
    res.body.errors.some((e) => e.field === 'email'),
    'expected at least one error against the email field'
  );
});

test('registering an email that already belongs to a verified user is rejected with 409', async () => {
  const { email } = await h.makeUser();

  const res = await h.api('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'Duplicate Account',
      email,
      password: 'ValidPass1!',
    },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
  assert.equal(res.body.data, undefined);
});

// ============================================================
// Profile
// ============================================================

test('GET /api/users/profile returns the calling user and not somebody else', async () => {
  const caller = await h.makeUser({ fullName: 'Profile Owner' });
  const other = await h.makeUser({ fullName: 'Someone Else' });

  const res = await h.api('/api/users/profile', { token: caller.token });

  assert.equal(res.status, 200);
  const returned = res.body.data.user;

  assert.equal(String(returned._id), String(caller.user._id));
  assert.equal(returned.email, caller.email);
  assert.equal(returned.fullName, 'Profile Owner');
  assert.notEqual(String(returned._id), String(other.user._id));

  assert.equal(returned.password, undefined);
  assert.equal(returned.resetPasswordToken, undefined);
});

// ============================================================
// Preferences round-trip
// ============================================================

test('PATCH /api/users/preferences persists both languages and a later read sees them', async () => {
  const { token } = await h.makeUser();

  const patched = await h.api('/api/users/preferences', {
    method: 'PATCH',
    token,
    body: { spokenLanguage: 'fr', listeningLanguage: 'ur' },
  });

  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.user.preferences.spokenLanguage, 'fr');
  assert.equal(patched.body.data.user.preferences.listeningLanguage, 'ur');

  // The write must survive the response: read it back on a fresh request,
  // which re-loads the user from the database in `protect`.
  const reread = await h.api('/api/users/profile', { token });

  assert.equal(reread.status, 200);
  assert.equal(
    reread.body.data.user.preferences.spokenLanguage,
    'fr',
    'spokenLanguage was not persisted'
  );
  assert.equal(
    reread.body.data.user.preferences.listeningLanguage,
    'ur',
    'listeningLanguage was not persisted'
  );
});

test('PATCH /api/users/preferences leaves untouched fields alone', async () => {
  const { token } = await h.makeUser();

  await h.api('/api/users/preferences', {
    method: 'PATCH',
    token,
    body: { spokenLanguage: 'es', listeningLanguage: 'de' },
  });

  // Send only one of the two fields.
  const partial = await h.api('/api/users/preferences', {
    method: 'PATCH',
    token,
    body: { spokenLanguage: 'it' },
  });

  assert.equal(partial.status, 200);
  assert.equal(partial.body.data.user.preferences.spokenLanguage, 'it');
  assert.equal(
    partial.body.data.user.preferences.listeningLanguage,
    'de',
    'a partial update clobbered the field that was not sent'
  );

  const reread = await h.api('/api/users/profile', { token });
  assert.equal(reread.body.data.user.preferences.spokenLanguage, 'it');
  assert.equal(reread.body.data.user.preferences.listeningLanguage, 'de');
});
