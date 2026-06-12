/**
 * ============================================================
 * API Client — IntelliMeet Frontend
 * ============================================================
 * Centralised HTTP client for all backend API communication.
 * 
 * Features:
 *  - Automatic Bearer token injection from auth store
 *  - Consistent error handling & response parsing
 *  - Typed request/response helpers
 *  - Automatic logout on 401 (token expired)
 * ============================================================
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// ---- Types ----

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  errors?: Array<{ field?: string; message: string }>
  timestamp: string
}

export interface AuthResponseData {
  token: string
  user: BackendUser
}

export interface BackendUser {
  _id: string
  fullName: string
  email: string
  preferences: {
    spokenLanguage: string
    listeningLanguage: string
  }
  isEmailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

// ---- Error class ----

export class ApiError extends Error {
  status: number
  errors: Array<{ field?: string; message: string }>

  constructor(
    message: string,
    status: number,
    errors: Array<{ field?: string; message: string }> = []
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

// ---- Core fetch wrapper ----

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  // Get token from persisted zustand storage
  let token: string | null = null
  try {
    const stored = localStorage.getItem('intellimeet-auth-storage')
    if (stored) {
      const parsed = JSON.parse(stored)
      token = parsed?.state?.token || null
    }
  } catch {
    // Ignore parse errors
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  const data: ApiResponse<T> = await response.json()

  if (!response.ok || !data.success) {
    // On 401, clear auth state (token expired or invalid)
    if (response.status === 401) {
      try {
        localStorage.removeItem('intellimeet-auth-storage')
      } catch {
        // Ignore
      }
    }

    throw new ApiError(
      data.message || 'Something went wrong',
      response.status,
      data.errors || []
    )
  }

  return data.data as T
}

// ============================================================
// Auth API
// ============================================================

export const authApi = {
  /**
   * Register a new user account.
   * Returns success message but no token (must verify OTP first).
   */
  register: (body: { fullName: string; email: string; password: string }) =>
    request<{ user: BackendUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /**
   * Authenticate an existing user.
   */
  login: (body: { email: string; password: string }) =>
    request<AuthResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /**
   * Verify the 6-digit OTP sent to the user's email.
   */
  verifyOtp: (body: { email: string; otp: string }) =>
    request<AuthResponseData>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /**
   * Resend a new 6-digit OTP to the user's email.
   */
  resendOtp: (email: string) =>
    request<{ message: string }>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (password: string, token: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ password, token }),
    }),
}

// ============================================================
// User API (Protected)
// ============================================================

export const userApi = {
  /**
   * Get the authenticated user's profile.
   */
  getProfile: () =>
    request<{ user: BackendUser }>('/users/profile', {
      method: 'GET',
    }),

  /**
   * Update language preferences.
   */
  updatePreferences: (body: {
    spokenLanguage?: string
    listeningLanguage?: string
  }) =>
    request<{ user: BackendUser }>('/users/preferences', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  /**
   * Update the user's password.
   */
  updatePassword: (body: {
    currentPassword?: string
    newPassword?: string
  }) =>
    request<{ success: boolean }>('/users/password', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  /**
   * Permanently delete the user's account.
   */
  deleteAccount: () =>
    request<{ success: boolean }>('/users/profile', {
      method: 'DELETE',
    }),
}
