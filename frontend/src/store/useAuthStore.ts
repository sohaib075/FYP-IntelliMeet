import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isTokenExpired } from '@/lib/jwt'

/**
 * User interface matching the backend User model.
 *
 * Field mapping (backend → frontend):
 *  - _id         → id
 *  - fullName    → name  (aliased for UI convenience)
 *  - email       → email
 *  - preferences.spokenLanguage    → preferences.sourceLanguage
 *  - preferences.listeningLanguage → preferences.targetLanguage
 */
export interface User {
  id: string
  name: string
  email: string
  phoneNumber?: string
  preferences: {
    sourceLanguage: string
    targetLanguage: string
  }
}

/**
 * Where the session stands right now.
 *
 *  - 'loading'          a token was restored from storage but has not been
 *                       confirmed with the server yet. Route guards render a
 *                       spinner here rather than guessing, so neither the
 *                       dashboard nor the login page flashes on top of the
 *                       answer that is about to arrive.
 *  - 'authenticated'    the server accepted the token on this page load.
 *  - 'unverified'       we hold a token that looks live, but the server could
 *                       not be reached to confirm it. Protected pages stay
 *                       open (a flaky network must not sign anyone out) while
 *                       the login page ALSO stays reachable — otherwise an
 *                       unreachable backend traps the user on a dashboard
 *                       that cannot load, with no way back to /login.
 *  - 'unauthenticated'  no token, an expired one, or the server rejected it.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unverified' | 'unauthenticated'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  /**
   * Whether the check against the server has finished on THIS page load —
   * whatever its outcome. Deliberately NOT persisted: a fresh load re-checks.
   */
  sessionChecked: boolean
  /**
   * Whether that check actually succeeded. False when the backend could not be
   * reached, which is what separates 'unverified' from 'authenticated'.
   */
  sessionVerified: boolean

  // Actions
  login: (token: string, user: User) => void
  logout: () => void
  /** Replace the cached user after the server confirms the session. */
  setUser: (user: User) => void
  /**
   * Finish the session check for this page load.
   * @param verified true only when the server actually confirmed the token.
   */
  resolveSession: (verified: boolean) => void
  updatePreferences: (preferences: Partial<User['preferences']>) => void
  updateProfile: (data: Partial<User>) => void
}

/**
 * Maps the raw backend user object to our frontend User shape.
 * This keeps the mapping logic in one place.
 */
export function mapBackendUser(backendUser: {
  _id: string
  fullName: string
  email: string
  phoneNumber?: string
  preferences?: {
    spokenLanguage?: string
    listeningLanguage?: string
  }
}): User {
  return {
    id: backendUser._id,
    name: backendUser.fullName,
    email: backendUser.email,
    phoneNumber: backendUser.phoneNumber,
    preferences: {
      sourceLanguage: backendUser.preferences?.spokenLanguage || 'en',
      targetLanguage: backendUser.preferences?.listeningLanguage || 'en',
    },
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      sessionChecked: false,
      sessionVerified: false,

      login: (token: string, user: User) =>
        // A token we just received from /auth/login is server-issued by
        // definition, so this page load needs no extra verification round-trip.
        set({ token, user, isAuthenticated: true, sessionChecked: true, sessionVerified: true }),

      logout: () =>
        // Clearing the token here also rewrites the persisted copy (see
        // `partialize`), so a stale session cannot be resurrected by a reload
        // or by the Back button.
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          sessionChecked: true,
          sessionVerified: false,
        }),

      setUser: (user: User) => set({ user }),

      resolveSession: (verified: boolean) =>
        set({ sessionChecked: true, sessionVerified: verified }),

      updatePreferences: (preferences) =>
        set((state) => ({
          user: state.user ? { ...state.user, preferences: { ...state.user.preferences, ...preferences } } : null
        })),

      updateProfile: (data) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null
        })),
    }),
    {
      name: 'intellimeet-auth-storage',

      /**
       * Persist ONLY the credentials. `isAuthenticated` and `sessionChecked`
       * are derived at load time instead of being read back from disk, so
       * hand-editing localStorage cannot flip the app into a logged-in state,
       * and the flag can never drift out of sync with the token it describes.
       */
      partialize: (state) => ({ token: state.token, user: state.user }),

      /**
       * Runs when the persisted blob is merged back in. This is where an
       * already-expired token is dropped, so a dead session never reaches a
       * route guard in the first place.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AuthState>
        const token = typeof saved.token === 'string' ? saved.token : null
        const usable = !!token && !isTokenExpired(token)

        return {
          ...current,
          token: usable ? token : null,
          user: usable ? saved.user ?? null : null,
          isAuthenticated: usable,
          // A restored token still has to be confirmed with the server;
          // only a fresh login short-circuits that.
          sessionChecked: false,
          sessionVerified: false,
        }
      },
    }
  )
)

/**
 * The single source of truth every route guard reads.
 *
 * Derived rather than stored so the three pieces can never disagree:
 * no token at all is immediately 'unauthenticated' (no spinner for a first-time
 * visitor), and a restored token stays 'loading' only until the one-shot
 * session check in `useSessionBootstrap` resolves it.
 */
export function selectAuthStatus(state: AuthState): AuthStatus {
  if (!state.token) return 'unauthenticated'
  if (!state.sessionChecked) return 'loading'
  return state.sessionVerified ? 'authenticated' : 'unverified'
}

/** Hook form of {@link selectAuthStatus}. */
export function useAuthStatus(): AuthStatus {
  return useAuthStore(selectAuthStatus)
}
