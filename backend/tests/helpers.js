/**
 * ============================================================
 * Test Helpers
 * ============================================================
 * Zero-dependency harness built on Node's built-in test runner
 * (`node:test`), so there is nothing extra to install.
 *
 * Design decisions:
 *  - The Express app is started in-process on an ephemeral port, so tests
 *    exercise the real middleware chain (auth, validators, rate limits,
 *    error handler) rather than calling controllers directly.
 *  - LiveKit is STUBBED. Tests must run offline, must not consume the
 *    project's quota, and must not depend on a network round trip.
 *  - Fixtures use a reserved email domain (@test.invalid) and are removed
 *    in teardown, so a shared development database stays clean.
 *
 * Run with:  npm test
 * ============================================================
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const config = require('../config/environment');

/** Emails created by tests all share this suffix so cleanup is exact. */
const TEST_EMAIL_SUFFIX = '@test.invalid';

// ============================================================
// LiveKit stub
// ============================================================
/**
 * Replace every LiveKit network call with an in-memory fake.
 * Returns a `calls` log so tests can assert what the server *tried* to do.
 */
function stubLiveKit() {
  const livekitService = require('../services/livekitService');
  const calls = [];
  const rooms = new Map();

  const original = { ...livekitService };

  livekitService.isConfigured = () => true;

  livekitService.createParticipantToken = async (opts) => {
    calls.push(['createParticipantToken', opts]);
    // A structurally real JWT so tests can decode and assert on the claims.
    return jwt.sign(
      {
        sub: opts.identity,
        name: opts.name,
        metadata: JSON.stringify({ role: opts.role }),
        video: { room: opts.roomName, roomJoin: true, roomAdmin: false },
      },
      'test-livekit-secret',
      { expiresIn: 180 }
    );
  };

  livekitService.ensureRoom = async (roomName) => {
    calls.push(['ensureRoom', roomName]);
    if (!rooms.has(roomName)) rooms.set(roomName, { name: roomName, participants: [] });
    return rooms.get(roomName);
  };

  livekitService.deleteRoom = async (roomName) => {
    calls.push(['deleteRoom', roomName]);
    rooms.delete(roomName);
  };

  livekitService.listParticipants = async (roomName) => {
    calls.push(['listParticipants', roomName]);
    return rooms.get(roomName)?.participants ?? [];
  };

  livekitService.getParticipant = async (roomName, identity) => {
    calls.push(['getParticipant', roomName, identity]);
    return (rooms.get(roomName)?.participants ?? []).find((p) => p.identity === identity) ?? null;
  };

  livekitService.removeParticipant = async (roomName, identity) => {
    calls.push(['removeParticipant', roomName, identity]);
    const room = rooms.get(roomName);
    if (room) room.participants = room.participants.filter((p) => p.identity !== identity);
  };

  livekitService.muteTrack = async (roomName, identity, source) => {
    calls.push(['muteTrack', roomName, identity, source]);
    return { muted: true };
  };

  return {
    calls,
    rooms,
    /** Pretend someone is connected, so removal/mute paths have a target. */
    addParticipant(roomName, identity, tracks = []) {
      if (!rooms.has(roomName)) rooms.set(roomName, { name: roomName, participants: [] });
      rooms.get(roomName).participants.push({ identity, name: identity, tracks });
    },
    restore() {
      Object.assign(livekitService, original);
    },
  };
}

// ============================================================
// Server lifecycle
// ============================================================

let server = null;
let baseUrl = null;

/** Boot the real Express app on an ephemeral port and connect to MongoDB. */
async function startServer() {
  if (server) return baseUrl;

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  }

  // Required late so environment and any LiveKit stub are in place first.
  const app = require('../app');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
    baseUrl = null;
  }
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
}

// ============================================================
// HTTP
// ============================================================

/**
 * Perform a request against the test server.
 * @returns {Promise<{status:number, body:any}>}
 */
async function api(path, { method = 'GET', token = null, body = null, headers = {} } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

// ============================================================
// Fixtures
// ============================================================

let userCounter = 0;
/**
 * Ids this process created. Cleanup is scoped to these so several test files
 * can run at once against a shared database without deleting each other's
 * fixtures mid-run.
 */
const createdUserIds = [];

/** Create a user and return { user, token }. Cleaned up by cleanupFixtures(). */
async function makeUser(overrides = {}) {
  const User = require('../models/User');
  userCounter += 1;
  const email = `t${userCounter}-${process.pid}${TEST_EMAIL_SUFFIX}`;
  const user = new User({
    fullName: overrides.fullName || `Test User ${userCounter}`,
    email,
    password: overrides.password || 'TestPass1!',
    authProvider: 'local',
    ...overrides,
  });
  await user.save();
  createdUserIds.push(user._id);
  const token = jwt.sign({ id: String(user._id) }, config.JWT_SECRET, { expiresIn: '1h' });
  return { user, token, email };
}

/** Create a meeting through the API so it goes through the real code path. */
async function makeMeeting(token, title = 'Test meeting') {
  const res = await api('/api/meetings', { method: 'POST', token, body: { title } });
  if (res.status !== 201) {
    throw new Error(`makeMeeting failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.meeting;
}

/**
 * Remove everything THIS process created, and nothing else.
 * Scoped by id rather than by the email suffix so concurrent test files do
 * not delete each other's fixtures while they are still running.
 */
async function cleanupFixtures() {
  const User = require('../models/User');
  const Meeting = require('../models/Meeting');
  if (!createdUserIds.length) return;
  await Meeting.deleteMany({ hostId: { $in: createdUserIds } });
  await User.deleteMany({ _id: { $in: createdUserIds } });
  createdUserIds.length = 0;
}

module.exports = {
  startServer,
  stopServer,
  api,
  makeUser,
  makeMeeting,
  cleanupFixtures,
  stubLiveKit,
  TEST_EMAIL_SUFFIX,
};
