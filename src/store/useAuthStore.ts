import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  name: string
  email: string
  role: 'USER' | 'ADMIN'
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
  updatePreferences: (preferences: User['preferences']) => void
  updateProfile: (name: string) => void
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
