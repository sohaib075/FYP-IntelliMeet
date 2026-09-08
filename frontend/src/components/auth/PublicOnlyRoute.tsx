import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuthStatus } from "@/store/useAuthStore"
import { AuthLoading } from "./AuthLoading"
import { safeRedirectTarget } from "./usePostLoginRedirect"

/**
 * Mirror image of ProtectedRoute: gates pages that only make sense when
 * signed OUT — login, register, and the email-verification / forgot-password
 * steps that precede having an account.
 *
 * Note `/reset-password` is deliberately NOT behind this guard. It is reached
 * from a one-time emailed link, and it has to work even if the browser still
 * holds a stale session for the account being recovered.
 *
 * 'unverified' (we hold a token but could not reach the server to confirm it)
 * deliberately falls through to the login page. Redirecting on an unconfirmed
 * session would mean an unreachable backend traps the user on a dashboard that
 * cannot load, with no route back to /login to sign in again.
 *
 * There is no loop risk against ProtectedRoute: both read the same derived
 * status, and only 'authenticated' redirects here while only 'unauthenticated'
 * redirects there — so at most one of them ever wants to move.
 */
export function PublicOnlyRoute() {
  const status = useAuthStatus()
  const location = useLocation()

  if (status === 'loading') return <AuthLoading />

  if (status === 'authenticated') {
    // If the guard bounced them here from a protected page, send them back to
    // it rather than dumping them on the dashboard. Uses the shared sanitiser
    // so this cannot become an open redirect through history state.
    const target = safeRedirectTarget(location.state)
    if (target !== location.pathname) return <Navigate to={target} replace />
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
