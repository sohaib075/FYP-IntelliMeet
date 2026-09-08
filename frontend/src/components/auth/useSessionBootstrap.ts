import { useEffect } from 'react'
import { useAuthStore, mapBackendUser } from '@/store/useAuthStore'
import { userApi, ApiError } from '@/lib/api'

/**
 * ============================================================
 * Session bootstrap
 * ============================================================
 * Confirms a token restored from localStorage is still good BEFORE the route
 * guards commit to showing a protected page, and keeps that decision honest
 * for the rest of the page's life.
 *
 * Three jobs:
 *  1. One verification round-trip per page load (GET /users/profile, which is
 *     behind `protect`), so a revoked or expired session collapses to
 *     'unauthenticated' instead of rendering a dashboard that cannot load.
 *  2. Re-checks when the page is restored from the browser's back/forward
 *     cache, where a whole document — including React state — can come back
 *     from before a sign-out that happened elsewhere.
 *  3. Mirrors sign-out across tabs.
 *
 * Two invariants this file must never break:
 *  - The status ALWAYS resolves. `loading` renders a full-screen spinner in
 *    both guards, so a path that leaves `sessionChecked` false pins the entire
 *    app — /login included — behind a spinner with no way out.
 *  - A result is only applied if it still describes the CURRENT token. An
 *    in-flight verification that lands after a sign-out must not resurrect the
 *    previous user, which `partialize` would then write back to disk.
 *
 * Mounted once, at the top of <App />.
 * ============================================================
 */

/** Same key as the persist middleware in useAuthStore. */
const AUTH_STORAGE_KEY = 'intellimeet-auth-storage'

/**
 * Hard ceiling on the verification request. `fetch` has no default timeout, so
 * without this a hung connection would hold every route on the spinner.
 */
const VERIFY_TIMEOUT_MS = 10_000

/**
 * Coalesces concurrent callers (React StrictMode double-invokes effects in
 * dev) while still guaranteeing a fresh pass afterwards for anyone who asked
 * during one — dropping that request would leave a newly adopted token
 * unverified.
 */
let inFlight: Promise<void> | null = null
let rerunQueued = false

/** Reads the token that other tabs can see, which outranks our in-memory copy. */
function tokenInStorage(): string | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const token = JSON.parse(raw)?.state?.token
    return typeof token === 'string' && token ? token : null
  } catch {
    return null
  }
}

async function verifySession(): Promise<void> {
  // Capture the token this pass is about. Every write below is conditional on
  // it still being the current one.
  const startedWith = useAuthStore.getState().token
  if (!startedWith) return

  const stillCurrent = () => useAuthStore.getState().token === startedWith

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new ApiError('Verification timed out', 0, [], 'TIMEOUT')), VERIFY_TIMEOUT_MS)
  )

  try {
    const { user } = await Promise.race([userApi.getProfile(), timeout])
    if (!stillCurrent()) return // signed out, or switched account, mid-flight

    useAuthStore.getState().setUser(mapBackendUser(user))
    useAuthStore.getState().resolveSession(true)
  } catch (err) {
    if (!stillCurrent()) return

    // The server refused this token. lib/api.ts already signs out for the
    // TOKEN_INVALID shape, but only when the body parsed as our JSON envelope —
    // a proxy's HTML 401 slips past it. Any 401 from a protected endpoint means
    // the token is not accepted, so end the session here rather than assuming
    // someone else did.
    if (err instanceof ApiError && err.status === 401) {
      useAuthStore.getState().logout()
      return
    }

    // Anything else — backend restarting, laptop offline, a 500, our timeout —
    // is NOT evidence the session is bad. Keep it, but mark it UNVERIFIED
    // rather than authenticated: protected pages stay open so a network blip
    // does not sign anyone out mid-meeting, while /login stays reachable so an
    // unreachable backend cannot trap the user on a dashboard that will not
    // load. The server remains the real gate on every request either way.
    useAuthStore.getState().resolveSession(false)
  }
}

function runVerification(): void {
  if (inFlight) {
    rerunQueued = true
    return
  }
  inFlight = verifySession().finally(() => {
    inFlight = null
    if (rerunQueued) {
      rerunQueued = false
      runVerification()
    }
  })
}

/**
 * Reconciles this tab against the shared localStorage copy, which is the only
 * state other tabs can reach. Returns true when a verification pass is needed.
 */
function syncWithStorage(): boolean {
  const stored = tokenInStorage()
  const current = useAuthStore.getState().token

  if (!stored && current) {
    // Signed out elsewhere (or restored from bfcache with a token that has
    // since been cleared) — drop this tab's session too.
    useAuthStore.getState().logout()
    return false
  }

  if (stored && stored !== current) {
    // Signed in, or switched account, elsewhere. Clear the previous identity
    // as well as the token: leaving the old `user` in place next to a new
    // credential would render one account's name over another's data.
    useAuthStore.setState({
      token: stored,
      user: null,
      isAuthenticated: true,
      sessionChecked: false,
      sessionVerified: false,
    })
    return true
  }

  return !!current
}

export function useSessionBootstrap(): void {
  useEffect(() => {
    const { token, sessionChecked } = useAuthStore.getState()

    if (token && !sessionChecked) {
      runVerification()
    } else if (!token && tokenInStorage()) {
      // The persist `merge` dropped an expired token from the store, but the
      // dead credential is still on disk. Rewrite it, so "signed out" means
      // signed out in storage too.
      useAuthStore.getState().logout()
    }

    // ---- back/forward cache ----
    // A bfcache restore replays a live document captured BEFORE a sign-out
    // that may have happened elsewhere, with its in-memory token intact.
    // Trusting that token would re-authenticate a session the user ended, so
    // reconcile against storage first and only then re-verify.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      if (syncWithStorage()) runVerification()
    }

    // ---- cross-tab ----
    // zustand/persist does not subscribe to `storage`, so without this a
    // second tab keeps rendering an authenticated shell after a sign-out.
    // (The event only fires in OTHER tabs, so this cannot loop on our writes.)
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY) return
      if (syncWithStorage()) runVerification()
    }

    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
}
