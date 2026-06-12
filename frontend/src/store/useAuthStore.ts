import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  preferences: {
    sourceLanguage: string
    targetLanguage: string
  }
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  
  // Actions
  login: (token: string, user: User) => void
  logout: () => void
  updatePreferences: (preferences: Partial<User['preferences']>) => void
  updateProfile: (name: string) => void
}

/**
 * Maps the raw backend user object to our frontend User shape.
 * This keeps the mapping logic in one place.
 */
export function mapBackendUser(backendUser: {
  _id: string
  fullName: string
  email: string
  preferences?: {
    spokenLanguage?: string
    listeningLanguage?: string
  }
}): User {
  return {
    id: backendUser._id,
    name: backendUser.fullName,
    email: backendUser.email,
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
      
      login: (token: string, user: User) => 
        set({ token, user, isAuthenticated: true }),
        
      logout: () => 
        set({ token: null, user: null, isAuthenticated: false }),
        
      updatePreferences: (preferences) => 
        set((state) => ({
          user: state.user ? { ...state.user, preferences: { ...state.user.preferences, ...preferences } } : null
        })),
        
      updateProfile: (name) => 
        set((state) => ({
          user: state.user ? { ...state.user, name } : null
        })),
    }),
    {
      name: 'intellimeet-auth-storage',
    }
  )
)
