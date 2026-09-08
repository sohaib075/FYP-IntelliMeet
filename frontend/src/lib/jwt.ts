/**
 * ============================================================
 * Client-side JWT inspection
 * ============================================================
 * Reads the `exp` claim out of the access token so the app can
 * drop an obviously-dead session before it renders a protected
 * page and fires a request that is guaranteed to 401.
 *
 * IMPORTANT — this is a UX optimisation, NOT a security boundary.
 * The payload is only base64-decoded, never verified: the signing
 * secret lives on the server and must never reach the browser.
 * Anyone can hand-craft a token that passes these checks. The real
 * decision is always made by `protect` in
 * backend/middleware/authMiddleware.js, which verifies the
 * signature and re-loads the user on every single request.
 * ============================================================
 */

export interface JwtPayload {
  id?: string
  iat?: number
  exp?: number
  [key: string]: unknown
}

/**
 * Decode the payload segment of a JWT.
 * Returns null for anything that is not a well-formed three-part token.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  if (typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    // JWT uses base64url; convert to standard base64 and re-pad.
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)

    // atob yields a binary string; this round-trip recovers UTF-8 correctly
    // for names and emails outside the ASCII range.
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )

    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? (parsed as JwtPayload) : null
  } catch {
    return null
  }
}

/**
 * True when the token carries an `exp` that has already passed.
 *
 * A token we cannot parse is treated as expired — it is unusable either way,
 * and refusing it here avoids rendering a session that cannot work.
 *
 * A token with no `exp` at all is treated as NOT expired: we genuinely cannot
 * tell, so the server gets to decide rather than us logging the user out.
 *
 * @param leewaySeconds clock-skew allowance; tokens within this window of
 *        expiry are already considered dead, so we never render a page using
 *        a token that dies mid-request.
 */
export function isTokenExpired(token: string | null | undefined, leewaySeconds = 5): boolean {
  if (!token) return true

  const payload = decodeJwtPayload(token)
  if (!payload) return true
  if (typeof payload.exp !== 'number') return false

  const nowSeconds = Date.now() / 1000
  return payload.exp <= nowSeconds + leewaySeconds
}
