/**
 * Meeting code helpers (mirror of backend/utils/meetingId.js).
 * Codes are ten lowercase letters shown as abc-defg-hij.
 */

export const MEETING_ID_PATTERN = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/

/**
 * Accept a code in any reasonable form and return the canonical id, or null:
 *   abc-defg-hij · abcdefghij · ABC DEFG HIJ · https://host/meet/abc-defg-hij
 */
export function normalizeMeetingId(raw: string | null | undefined): string | null {
  if (!raw) return null
  let s = raw.trim()
  const urlMatch = s.match(/([a-z]{3}-[a-z]{4}-[a-z]{3})/i)
  if (urlMatch) s = urlMatch[1]
  const letters = s.toLowerCase().replace(/[^a-z]/g, '')
  if (letters.length !== 10) return null
  return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`
}

export function isValidMeetingId(id: string | null | undefined): id is string {
  return typeof id === 'string' && MEETING_ID_PATTERN.test(id)
}

/** Shareable link for a meeting, built from where the app is actually served */
export function meetingLink(meetingId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/meet/${meetingId}`
}
