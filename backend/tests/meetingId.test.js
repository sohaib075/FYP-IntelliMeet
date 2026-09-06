/**
 * ============================================================
 * Unit tests — utils/meetingId.js
 * ============================================================
 * Meeting codes are the one identifier a user types by hand, so the
 * three functions here are tested directly rather than through the API:
 *
 *   generateMeetingId  — must ALWAYS produce the canonical abc-defg-hij
 *                        shape, and must not repeat itself in practice.
 *   isValidMeetingId   — strict gatekeeper for an already-normalised id.
 *   normalizeMeetingId — forgiving front door: accepts what a human is
 *                        likely to paste (spaces, capitals, a whole URL)
 *                        and returns the canonical form or null.
 *
 * One test at the end walks a code through the real API so the util and
 * the production meeting service cannot silently drift apart.
 * ============================================================
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const {
  generateMeetingId,
  isValidMeetingId,
  normalizeMeetingId,
  MEETING_ID_PATTERN,
} = require('../utils/meetingId');

/** The contract, restated locally so a change to the module cannot silently
 *  redefine what the tests are checking against. */
const CANONICAL = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

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
// generateMeetingId
// ============================================================

test('generateMeetingId always returns three lowercase groups of 3-4-3 letters', () => {
  for (let i = 0; i < 2000; i += 1) {
    const id = generateMeetingId();
    assert.match(id, CANONICAL, `generated id did not match the canonical shape: ${id}`);
  }
});

test('the pattern the module exports is the same contract the generator honours', () => {
  assert.equal(MEETING_ID_PATTERN.source, CANONICAL.source);
  for (let i = 0; i < 100; i += 1) {
    assert.ok(MEETING_ID_PATTERN.test(generateMeetingId()));
  }
});

test('5000 generated meeting ids are all distinct', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i += 1) seen.add(generateMeetingId());
  assert.equal(seen.size, 5000, 'generateMeetingId produced a duplicate within 5000 draws');
});

test('generateMeetingId uses the whole alphabet rather than a narrow slice of it', () => {
  // 5000 ids is 50,000 letters; every letter should appear many times over.
  // Guards against a broken byte-to-letter mapping that only emits a few chars.
  const letters = new Set();
  for (let i = 0; i < 5000; i += 1) {
    for (const ch of generateMeetingId().replace(/-/g, '')) letters.add(ch);
  }
  assert.equal(letters.size, 26, `expected all 26 letters, saw ${letters.size}`);
});

test('a freshly generated id is accepted by isValidMeetingId and is already normalised', () => {
  for (let i = 0; i < 500; i += 1) {
    const id = generateMeetingId();
    assert.ok(isValidMeetingId(id), `generator produced an id its own validator rejects: ${id}`);
    assert.equal(normalizeMeetingId(id), id, 'normalising a canonical id should be a no-op');
  }
});

// ============================================================
// isValidMeetingId
// ============================================================

test('isValidMeetingId accepts the canonical abc-defg-hij form', () => {
  assert.equal(isValidMeetingId('abc-defg-hij'), true);
  assert.equal(isValidMeetingId('zzz-zzzz-zzz'), true);
  assert.equal(isValidMeetingId('qwe-rtyu-iop'), true);
});

test('isValidMeetingId rejects ids containing digits', () => {
  for (const id of ['ab1-defg-hij', 'abc-de4g-hij', 'abc-defg-hi9', '123-4567-890']) {
    assert.equal(isValidMeetingId(id), false, `digits should be rejected: ${id}`);
  }
});

test('isValidMeetingId rejects wrong group lengths and missing separators', () => {
  for (const id of [
    'ab-defg-hij', // first group too short
    'abcd-defg-hij', // first group too long
    'abc-def-hij', // middle group too short
    'abc-defgh-hij', // middle group too long
    'abc-defg-hi', // last group too short
    'abc-defg-hijk', // last group too long
    'abcdefghij', // no separators at all
    'abc-defghij', // only one separator
    'abcdefg-hij',
    'abc-defg-hij-klm', // an extra group
    'abc defg hij', // spaces instead of hyphens
    'abc_defg_hij', // underscores instead of hyphens
    '', // empty
  ]) {
    assert.equal(isValidMeetingId(id), false, `malformed id should be rejected: "${id}"`);
  }
});

test('isValidMeetingId rejects uppercase letters instead of silently accepting them', () => {
  for (const id of ['ABC-DEFG-HIJ', 'Abc-defg-hij', 'abc-Defg-hij', 'abc-defg-hiJ']) {
    assert.equal(isValidMeetingId(id), false, `uppercase should be rejected: ${id}`);
  }
});

test('isValidMeetingId rejects non-string input without throwing', () => {
  for (const value of [null, undefined, 42, {}, [], true, Symbol('abc-defg-hij')]) {
    assert.equal(isValidMeetingId(value), false, `non-string should be rejected: ${String(value)}`);
  }
});

test('isValidMeetingId rejects surrounding whitespace, since it validates only normalised ids', () => {
  assert.equal(isValidMeetingId(' abc-defg-hij'), false);
  assert.equal(isValidMeetingId('abc-defg-hij\n'), false);
});

// ============================================================
// normalizeMeetingId — the forms a human might paste
// ============================================================

test('normalizeMeetingId returns the canonical id unchanged', () => {
  assert.equal(normalizeMeetingId('abc-defg-hij'), 'abc-defg-hij');
});

test('normalizeMeetingId re-hyphenates a code typed without separators', () => {
  assert.equal(normalizeMeetingId('abcdefghij'), 'abc-defg-hij');
});

test('normalizeMeetingId lowercases and re-hyphenates a spaced, uppercase code', () => {
  assert.equal(normalizeMeetingId('ABC DEFG HIJ'), 'abc-defg-hij');
});

test('normalizeMeetingId extracts the code from a pasted meeting URL', () => {
  assert.equal(normalizeMeetingId('http://x/meet/abc-defg-hij'), 'abc-defg-hij');
  assert.equal(normalizeMeetingId('https://intellimeet.app/meet/abc-defg-hij'), 'abc-defg-hij');
  assert.equal(normalizeMeetingId('https://intellimeet.app/meet/ABC-DEFG-HIJ'), 'abc-defg-hij');
});

test('normalizeMeetingId tolerates surrounding whitespace', () => {
  assert.equal(normalizeMeetingId('   abc-defg-hij   '), 'abc-defg-hij');
  assert.equal(normalizeMeetingId('\tabcdefghij\n'), 'abc-defg-hij');
});

test('normalizeMeetingId returns null for input that cannot be a meeting id', () => {
  for (const value of ['random123', '', null, undefined]) {
    assert.equal(
      normalizeMeetingId(value),
      null,
      `expected null for ${JSON.stringify(value)}`
    );
  }
});

test('normalizeMeetingId returns null for a 9-letter or 11-letter run', () => {
  assert.equal(normalizeMeetingId('abcdefghi'), null, '9 letters is one short');
  assert.equal(normalizeMeetingId('abcdefghijk'), null, '11 letters is one too many');
  assert.equal(normalizeMeetingId('ab-defg-hij'), null, 'nine letters, hyphenated');
  assert.equal(normalizeMeetingId('abcdefghijkl'), null, '12 letters is well past the limit');
});

test('a mistyped code is rejected rather than trimmed into a different real code', () => {
  // Regression guard. The URL-extraction regex used to run against every input,
  // so a typo containing a canonical-looking substring was silently rewritten:
  // 'abcd-defg-hij' became 'bcd-defg-hij', dropping the user into a stranger's
  // meeting instead of showing "that code doesn't exist". Extraction is now
  // gated on the input actually looking like a link.
  assert.equal(normalizeMeetingId('abcd-defg-hij'), null, 'extra leading letter must be rejected');
  assert.equal(normalizeMeetingId('abc-defg-hijk'), null, 'extra trailing letter must be rejected');
  assert.equal(normalizeMeetingId('xabc-defg-hij'), null, 'prefixed code must be rejected');
  assert.equal(normalizeMeetingId('abc-defg-hij-zzz'), null, 'suffixed code must be rejected');
  assert.equal(normalizeMeetingId('abc-defg-hijklmnop'), null, 'long tail must be rejected');
});

test('a pasted link still yields its code, including without hyphens', () => {
  assert.equal(normalizeMeetingId('http://x/meet/abc-defg-hij'), 'abc-defg-hij');
  assert.equal(normalizeMeetingId('https://x/meet/abc-defg-hij?utm=1'), 'abc-defg-hij');
  assert.equal(normalizeMeetingId('https://x/meet/abc-defg-hij#top'), 'abc-defg-hij');
  // The last path segment is used when the link carries an unhyphenated code.
  assert.equal(normalizeMeetingId('https://x/meet/abcdefghij'), 'abc-defg-hij');
});

test('normalizeMeetingId returns null for non-string input without throwing', () => {
  for (const value of [42, {}, [], true, () => {}]) {
    assert.equal(normalizeMeetingId(value), null, `non-string should normalise to null: ${String(value)}`);
  }
});

test('anything normalizeMeetingId accepts is then accepted by isValidMeetingId', () => {
  const inputs = [
    'abc-defg-hij',
    'abcdefghij',
    'ABC DEFG HIJ',
    'ABCDEFGHIJ',
    'http://x/meet/abc-defg-hij',
    '  Abc-DeFg-hIj  ',
    'abc.defg.hij',
    'random123',
    'abcdefghi',
    'abcdefghijk',
    '',
    null,
    undefined,
  ];
  for (const input of inputs) {
    const out = normalizeMeetingId(input);
    if (out !== null) {
      assert.ok(
        isValidMeetingId(out),
        `normalize accepted ${JSON.stringify(input)} but produced an invalid id: ${out}`
      );
    }
  }
});

test('normalizing is idempotent — normalising twice changes nothing', () => {
  for (const input of ['abcdefghij', 'ABC DEFG HIJ', 'http://x/meet/abc-defg-hij']) {
    const once = normalizeMeetingId(input);
    assert.equal(normalizeMeetingId(once), once, `not idempotent for ${input}`);
  }
});

// ============================================================
// The util and the real API must agree
// ============================================================

test('a meeting created through the API is given a canonical, round-trippable id', async () => {
  const { token } = await h.makeUser();
  const meeting = await h.makeMeeting(token, 'Meeting id round trip');

  assert.match(meeting.meetingId, CANONICAL);
  assert.ok(isValidMeetingId(meeting.meetingId));

  // What a user would actually type or paste must resolve back to the same id.
  const compact = meeting.meetingId.replace(/-/g, '');
  assert.equal(normalizeMeetingId(compact), meeting.meetingId);
  assert.equal(normalizeMeetingId(compact.toUpperCase()), meeting.meetingId);
  assert.equal(normalizeMeetingId(`https://intellimeet.app/meet/${meeting.meetingId}`), meeting.meetingId);
});
