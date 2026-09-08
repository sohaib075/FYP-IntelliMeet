import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuthStatus } from "@/store/useAuthStore"
import { AuthLoading } from "./AuthLoading"

/**
 * Gate for pages that require a signed-in user.
 *
 * Used as a layout route, so it covers direct URL entry, in-app <Link>
 * navigation and Back/Forward identically — every one of those re-renders
 * this component, and the decision is recomputed from the live store rather
 * than from anything cached in history.
 */
export function ProtectedRoute() {
  const status = useAuthStatus()
  const location = useLocation()

  // A token was restored but the server has not confirmed it yet. Rendering
  // either outcome now risks showing the wrong one, so wait.
  if (status === 'loading') return <AuthLoading />

  // 'unverified' means we hold a live-looking token but could not reach the
  // server to confirm it. Keep the page open: a flaky network or a restarting
  // backend must not sign someone out mid-meeting. Nothing is exposed by this —
  // every request still has to satisfy `protect` on the server.
  if (status === 'unauthenticated') {
    // `state.from` lets the login page send the user where they were actually
    // heading. `replace` keeps the rejected URL out of history, so Back does
    // not bounce between the guard and the login page.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
