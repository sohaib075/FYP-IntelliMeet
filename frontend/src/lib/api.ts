/**
 * ============================================================
 * API Client — IntelliMeet Frontend
 * ============================================================
 * Centralised HTTP client for all backend API communication.
 *
 * Features:
 *  - Automatic Bearer token injection from the auth store
 *  - Consistent error handling & response parsing
 *  - Machine-readable error codes (ApiError.code)
 *  - Automatic logout on 401 (token expired / invalid)
 * ============================================================
 */

import { useAuthStore } from '@/store/useAuthStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// ---- Types ----

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  code?: string
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
  phoneNumber?: string
  preferences: {
    spokenLanguage: string
    listeningLanguage: string
  }
  isEmailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type MeetingStatusDto = 'CREATED' | 'ACTIVE' | 'ENDED'

export interface LiveKitTokenDto {
  /** Short-lived JWT scoped to exactly one room */
  token: string
  /** wss:// URL of the LiveKit server */
  url: string
  roomName: string
  /** Always the authenticated user's id — never client-supplied */
  identity: string
  name: string
  role: 'HOST' | 'PARTICIPANT'
  expiresIn: number
  meeting: MeetingDto
}

export interface MeetingDto {
  meetingId: string
  title: string
  status: MeetingStatusDto
  host: { id: string; name: string | null }
  isHost: boolean
  locked: boolean
  scheduledFor: string | null
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  participantCount: number
  url?: string
}

// ---- Error class ----

export class ApiError extends Error {
  status: number
  code: string | null
  errors: Array<{ field?: string; message: string }>

  constructor(
    message: string,
    status: number,
    errors: Array<{ field?: string; message: string }> = [],
    code: string | null = null
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.code = code
  }
}

/** Narrow any thrown value to an ApiError (network failures become status 0 / NETWORK) */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  const message = err instanceof Error ? err.message : 'Unable to connect to server'
  return new ApiError(message || 'Unable to connect to server', 0, [], 'NETWORK')
}

// ---- Core fetch wrapper ----

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const token = useAuthStore.getState().token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(url, { ...options, headers })
  } catch {
    throw new ApiError('Unable to connect to server', 0, [], 'NETWORK')
  }

  // A proxy error page, an empty body or a dropped connection is not JSON.
  let data: ApiResponse<T> | null = null
  try {
    data = (await response.json()) as ApiResponse<T>
  } catch {
    data = null
  }

  if (!response.ok || !data || !data.success) {
    if (response.status === 401 && data?.code === 'TOKEN_INVALID') {
      // Session token expired or invalid (NOT a wrong-password 401):
      // clear the in-memory store, which also rewrites the persisted
      // copy so stale state cannot be resurrected.
      useAuthStore.getState().logout()
    }
    throw new ApiError(
      data?.message || `Request failed (${response.status})`,
      response.status,
      data?.errors || [],
      data?.code || null
    )
  }

  return data.data as T
}

// ============================================================
// Auth API
// ============================================================

export const authApi = {
  /** Register a new account. No token is returned until the OTP is verified. */
  register: (body: { fullName: string; email: string; password: string }) =>
    request<{ user: BackendUser }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponseData>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  googleAuth: (token: string) =>
    request<AuthResponseData>('/auth/google', { method: 'POST', body: JSON.stringify({ token }) }),

  verifyOtp: (body: { email: string; otp: string }) =>
    request<AuthResponseData>('/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) }),

  resendOtp: (email: string) =>
    request<{ message: string }>('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (password: string, token: string) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ password, token }) }),
}

// ============================================================
// User API (Protected)
// ============================================================

export const userApi = {
  getProfile: () => request<{ user: BackendUser }>('/users/profile', { method: 'GET' }),

  updateProfile: (body: {
    fullName?: string
    email?: string
    phoneNumber?: string
    sourceLanguage?: string
    targetLanguage?: string
  }) => request<{ user: BackendUser }>('/users/profile', { method: 'PUT', body: JSON.stringify(body) }),

  updatePreferences: (body: { spokenLanguage?: string; listeningLanguage?: string }) =>
    request<{ user: BackendUser }>('/users/preferences', { method: 'PATCH', body: JSON.stringify(body) }),

  updatePassword: (body: { currentPassword?: string; newPassword?: string }) =>
    request<{ success: boolean }>('/users/password', { method: 'PUT', body: JSON.stringify(body) }),

  deleteAccount: () => request<{ success: boolean }>('/users/profile', { method: 'DELETE' }),
}

// ============================================================
// Meeting API (Protected)
// ============================================================

export const meetingApi = {
  /** Create a meeting; the caller becomes host. The server generates the id. */
  create: (body: { title?: string; scheduledFor?: string } = {}) =>
    request<{ meeting: MeetingDto }>('/meetings', { method: 'POST', body: JSON.stringify(body) }),

  /** Meetings the caller hosted or attended, newest first. */
  list: (status?: MeetingStatusDto) =>
    request<{ meetings: MeetingDto[] }>(`/meetings${status ? `?status=${status}` : ''}`, { method: 'GET' }),

  /**
   * Validate / look up a meeting. 404 MEETING_NOT_FOUND if it does not exist,
   * 403 PARTICIPANT_BANNED if the caller was blocked. Never creates anything.
   */
  get: (meetingId: string) =>
    request<{ meeting: MeetingDto }>(`/meetings/${encodeURIComponent(meetingId)}`, { method: 'GET' }),

  /** Host only: rename or lock. */
  update: (meetingId: string, body: { title?: string; locked?: boolean }) =>
    request<{ meeting: MeetingDto }>(`/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  /** Host only: end for everyone. */
  end: (meetingId: string) =>
    request<{ meeting: MeetingDto }>(`/meetings/${encodeURIComponent(meetingId)}/end`, { method: 'POST' }),

  /**
   * Authorise and mint a LiveKit token. This is the single gate for joining:
   * it fails with MEETING_NOT_FOUND / MEETING_ENDED / PARTICIPANT_BANNED /
   * MEETING_LOCKED, and with LIVEKIT_NOT_CONFIGURED when no media server is set up.
   */
  token: (meetingId: string) =>
    request<LiveKitTokenDto>(`/meetings/${encodeURIComponent(meetingId)}/token`, { method: 'POST' }),

  /** Host only: disconnect a participant, optionally blocking re-entry. */
  removeParticipant: (meetingId: string, identity: string, ban = false) =>
    request<{ removed: boolean; banned: boolean; disconnected: boolean }>(
      `/meetings/${encodeURIComponent(meetingId)}/participants/${encodeURIComponent(identity)}${ban ? '?ban=true' : ''}`,
      { method: 'DELETE' }
    ),

  /** Host only: server-side mute of someone's microphone or camera. */
  muteParticipant: (meetingId: string, identity: string, source: 'microphone' | 'camera') =>
    request<{ muted: boolean; source: string }>(
      `/meetings/${encodeURIComponent(meetingId)}/participants/${encodeURIComponent(identity)}/mute`,
      { method: 'POST', body: JSON.stringify({ source }) }
    ),
}

/** Human-readable copy for known error codes */
export function describeApiError(err: unknown): string {
  const e = toApiError(err)
  switch (e.code) {
    case 'INVALID_MEETING_ID':
      return "That doesn't look like a meeting code. Codes look like abc-defg-hij."
    case 'MEETING_NOT_FOUND':
      return 'Meeting not found. Check the code and try again.'
    case 'MEETING_ENDED':
      return 'This meeting has ended.'
    case 'MEETING_LOCKED':
      return 'The host has locked this meeting.'
    case 'PARTICIPANT_BANNED':
      return "You were removed from this meeting and can't rejoin."
    case 'NOT_HOST':
      return 'Only the host can do that.'
    case 'LIVEKIT_NOT_CONFIGURED':
      return 'The media server is not configured yet.'
    case 'LIVEKIT_ERROR':
      return "Couldn't reach the media server. Please try again."
    case 'PARTICIPANT_NOT_FOUND':
      return 'That person is no longer in the meeting.'
    case 'TRACK_NOT_FOUND':
      return 'That is already turned off.'
    case 'UNAUTHORIZED':
      return 'Please sign in again.'
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a few minutes and try again.'
    case 'NETWORK':
      return 'Unable to connect to the server. Check your connection and try again.'
    default:
      return e.message || 'Something went wrong. Please try again.'
  }
}
