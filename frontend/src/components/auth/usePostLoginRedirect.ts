import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"

/** Fallback destination when there is no remembered origin. */
export const DEFAULT_AUTHENTICATED_HOME = "/dashboard"

/** Never bounce a freshly signed-in user back onto a guest-only page. */
const GUEST_ONLY_PATHS = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password"]

export interface FromState {
  from?: { pathname?: string; search?: string }
}

/**
 * Turns a remembered origin from history state into a destination that is safe
 * to navigate to, or falls back to the dashboard.
 *
 * Exported so every consumer of `state.from` applies the SAME rule — the check
 * is a security boundary (see the open-redirect note below), and a second copy
 * that forgot one of these clauses would quietly undo it.
 */
export function safeRedirectTarget(state: unknown): string {
  const from = (state as FromState | null)?.from
  const pathname = from?.pathname

  const isSafe =
    typeof pathname === "string" &&
    // Must be an in-app absolute path. This rejects "//evil.com" and
    // "https://evil.com", which react-router would otherwise treat as a
    // destination — an open redirect through history state.
    pathname.startsWith("/") &&
    !pathname.startsWith("//") &&
    // Backslashes are normalised to forward slashes by some browsers, so
    // "/\evil.com" can escape the origin too.
    !pathname.startsWith("/\\") &&
    !GUEST_ONLY_PATHS.includes(pathname)

  return isSafe ? `${pathname}${from?.search ?? ""}` : DEFAULT_AUTHENTICATED_HOME
}

/**
 * Returns a function that sends a just-signed-in user to the page they were
 * originally trying to reach, falling back to the dashboard.
 *
 * Shared by all three entry points that can establish a session — the login
 * form, Google sign-in and OTP verification — so they cannot drift apart.
 *
 * Always navigates with `replace`, so the Back button after signing in does
 * not return to the login form (which would now just redirect forward again).
 */
export function usePostLoginRedirect() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    navigate(safeRedirectTarget(location.state), { replace: true })
  }, [navigate, location.state])
}
