/**
 * ============================================================
 * Meeting ID Utilities
 * ============================================================
 * Google Meet-style codes: ten random lowercase letters shown as
 * abc-defg-hij. 26^10 ≈ 1.4e14 possibilities, generated with
 * crypto.randomBytes. Uniqueness is enforced by the unique index
 * on Meeting.meetingId plus a retry loop in meetingService.
 * ============================================================
 */

const crypto = require('crypto');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const MEETING_ID_PATTERN = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

/** Generate a new random meeting id in abc-defg-hij form */
const generateMeetingId = () => {
  const bytes = crypto.randomBytes(10);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % 26];
  return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7, 10)}`;
};

/** Strict format check on an already-normalised id */
const isValidMeetingId = (id) => typeof id === 'string' && MEETING_ID_PATTERN.test(id);

/**
 * Accept user input in any of these forms and return the canonical id,
 * or null if it cannot be a meeting id:
 *   abc-defg-hij · abcdefghij · ABC DEFG HIJ · https://host/meet/abc-defg-hij
 */
const normalizeMeetingId = (raw) => {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();

  // Pull the code out of a pasted link, but ONLY when the input actually looks
  // like one. Searching for the pattern anywhere in every input would silently
  // rewrite a typo into a different, real code: 'abc-defg-hijk' would become
  // 'abc-defg-hij' and drop the user into a stranger's meeting instead of
  // showing "that code doesn't exist".
  if (s.includes('/')) {
    // Strip any query string or fragment, then prefer a hyphenated code and
    // otherwise fall back to the last path segment.
    const path = s.split(/[?#]/)[0];
    const hyphenated = path.match(/([a-z]{3}-[a-z]{4}-[a-z]{3})(?![a-z-])/i);
    s = hyphenated ? hyphenated[1] : path.split('/').filter(Boolean).pop() || '';
  }

  // Anything else must normalise to exactly ten letters in its entirety, so a
  // code with a stray extra character is rejected rather than trimmed.
  const letters = s.toLowerCase().replace(/[^a-z]/g, '');
  if (letters.length !== 10) return null;
  return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`;
};

module.exports = { generateMeetingId, isValidMeetingId, normalizeMeetingId, MEETING_ID_PATTERN };
