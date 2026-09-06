import { create } from 'zustand'

// ─── Types ───────────────────────────────────────────────────────────

export interface Participant {
  id: string
  name: string
  initials: string
  avatarColor: string
  language: string
  flag: string
  isMuted: boolean
  isVideoOff: boolean
  isScreenSharing?: boolean
  isHost: boolean
  joinedAt: number
  socketId?: string
}

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  senderInitials: string
  message: string
  timestamp: string
  isOwn: boolean
}

export interface MeetingEvent {
  id: string
  type: 'join' | 'leave' | 'mute' | 'unmute' | 'video-off' | 'video-on' | 'info'
  message: string
  timestamp: number
}

export type MeetingStatus = 'idle' | 'lobby' | 'connecting' | 'active' | 'ended'

// ─── Store Interface ────────────────────────────────────────────────

interface MeetingState {
  // Room
  meetingId: string | null
  title: string
  status: MeetingStatus
  startedAt: number | null
  elapsedSeconds: number

  // Participants
  participants: Participant[]

  // Chat
  messages: ChatMessage[]
  unreadCount: number

  // Events (in-meeting notifications)
  events: MeetingEvent[]

  // Local user media state
  localUserId: string | null
  localIsMuted: boolean
  localIsVideoOff: boolean
  localIsScreenSharing: boolean
  sourceLang: string
  targetLang: string

  // WebRTC simulation log
  signalingLog: string[]

  // ─── Actions ─────────────────────────────────────────────────────

  // Room lifecycle
  joinMeeting: (config: {
    meetingId: string
    title: string
    /** Authenticated user id — becomes the participant id (matches the server) */
    userId: string
    userName: string
    sourceLang: string
    targetLang: string
    micOn: boolean
    videoOn: boolean
  }) => void
  setStatus: (status: MeetingStatus) => void
  /** Apply authoritative room info sent by the server on join */
  setRoomInfo: (info: { title?: string; startedAt?: number }) => void
  /** Replace chat history with what the server holds (no unread bump) */
  loadHistory: (messages: Array<Omit<ChatMessage, 'id' | 'isOwn'>>) => void
  leaveMeeting: () => void
  tick: () => void

  // Participants
  addParticipant: (p: Participant) => void
  removeParticipant: (id: string) => void
  updateParticipant: (id: string, updates: Partial<Participant>) => void

  // Chat
  sendMessage: (message: string) => void
  receiveMessage: (msg: Omit<ChatMessage, 'id' | 'isOwn'>) => void
  clearUnread: () => void

  // Events
  addEvent: (event: Omit<MeetingEvent, 'id' | 'timestamp'>) => void
  dismissEvent: (id: string) => void

  // Local media
  toggleMic: () => void
  toggleVideo: () => void
  toggleScreenShare: () => void

  // Signaling log
  logSignaling: (entry: string) => void

  // Reset
  reset: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────

let _idCounter = 0
const uid = () => `${Date.now()}-${++_idCounter}`

const formatTime = () => {
  const now = new Date()
  return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const initialState = {
  meetingId: null as string | null,
  localUserId: null as string | null,
  title: '',
  status: 'idle' as MeetingStatus,
  startedAt: null as number | null,
  elapsedSeconds: 0,
  participants: [] as Participant[],
  messages: [] as ChatMessage[],
  unreadCount: 0,
  events: [] as MeetingEvent[],
  localIsMuted: false,
  localIsVideoOff: false,
  localIsScreenSharing: false,
  sourceLang: 'en',
  targetLang: 'zh',
  signalingLog: [] as string[],
}

import { getSocket } from '@/lib/socket'

// ─── Store ──────────────────────────────────────────────────────────

export const useMeetingStore = create<MeetingState>((set, get) => ({
  ...initialState,

  // ── Room lifecycle ────────────────────────────────────────────────

  joinMeeting: (config) => {
    // The participant id is the authenticated user id, so it matches the
    // identity the server derives from the JWT (and survives a refresh).
    const newUserId = config.userId
    const hostParticipant: Participant = {
      id: newUserId,
      name: config.userName,
      initials: config.userName.substring(0, 2).toUpperCase(),
      avatarColor: '#3B82F6',
      language: config.sourceLang === 'ur' ? 'Urdu' : config.sourceLang === 'zh' ? 'Chinese' : 'English',
      flag: config.sourceLang === 'ur' ? '🇵🇰' : config.sourceLang === 'zh' ? '🇨🇳' : '🇬🇧',
      isMuted: !config.micOn,
      isVideoOff: !config.videoOn,
      isScreenSharing: false,
      isHost: false,
      joinedAt: Date.now(),
    }

    set({
      meetingId: config.meetingId,
      localUserId: newUserId,
      title: config.title || 'IntelliMeet Session',
      status: 'connecting',
      startedAt: null,
      elapsedSeconds: 0,
      participants: [hostParticipant],
      messages: [],
      unreadCount: 0,
      events: [],
      localIsMuted: !config.micOn,
      localIsVideoOff: !config.videoOn,
      sourceLang: config.sourceLang,
      targetLang: config.targetLang,
      signalingLog: [],
    })
  },

  setStatus: (status) => {
    set((state) => ({
      status,
      startedAt: status === 'active' && !state.startedAt ? Date.now() : state.startedAt,
    }))
  },

  setRoomInfo: (info) => {
    set((state) => ({
      title: info.title ?? state.title,
      startedAt: info.startedAt ?? state.startedAt,
    }))
  },

  loadHistory: (messages) => {
    const localUserId = get().localUserId
    set({
      messages: messages.map((m) => ({
        ...m,
        id: uid(),
        isOwn: m.senderId === localUserId,
        senderName: m.senderId === localUserId ? 'You' : m.senderName,
      })),
    })
  },

  leaveMeeting: () => {
    set({ ...initialState })
  },

  tick: () => {
    set((state) => {
      if (state.status !== 'active' || !state.startedAt) return state
      return { elapsedSeconds: Math.floor((Date.now() - state.startedAt) / 1000) }
    })
  },

  // ── Participants ──────────────────────────────────────────────────

  addParticipant: (p) => {
    set((state) => ({
      participants: [...state.participants, p],
    }))
  },

  removeParticipant: (id) => {
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== id),
    }))
  },

  updateParticipant: (id, updates) => {
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }))
  },

  // ── Chat ──────────────────────────────────────────────────────────

  sendMessage: (message) => {
    const state = get()
    const localUser = state.participants.find((p) => p.id === state.localUserId)
    if (!localUser || !message.trim()) return

    const msg: ChatMessage = {
      id: uid(),
      senderId: localUser.id,
      senderName: 'You',
      senderInitials: localUser.initials,
      message: message.trim(),
      timestamp: formatTime(),
      isOwn: true,
    }
    set((state) => ({
      messages: [...state.messages, msg],
    }))

    const socket = getSocket()
    if (socket && state.meetingId) {
      socket.emit('send-message', state.meetingId, {
        senderId: localUser.id,
        senderName: localUser.name,
        senderInitials: localUser.initials,
        message: message.trim(),
        timestamp: msg.timestamp
      })
    }
  },

  receiveMessage: (msg) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: uid(),
      isOwn: false,
    }
    set((state) => ({
      messages: [...state.messages, newMsg],
      unreadCount: state.unreadCount + 1,
    }))
  },

  clearUnread: () => set({ unreadCount: 0 }),

  // ── Events ────────────────────────────────────────────────────────

  addEvent: (event) => {
    const id = uid()
    const newEvent: MeetingEvent = {
      ...event,
      id,
      timestamp: Date.now(),
    }
    set((state) => ({
      events: [...state.events, newEvent],
    }))
    setTimeout(() => {
      get().dismissEvent(id)
    }, 2500)
  },

  dismissEvent: (id) => {
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
    }))
  },

  // ── Local media ───────────────────────────────────────────────────

  toggleMic: () => {
    const state = get()
    const newMuted = !state.localIsMuted
    set((s) => ({
      localIsMuted: newMuted,
      participants: s.participants.map((p) =>
        p.id === s.localUserId ? { ...p, isMuted: newMuted } : p
      ),
    }))

    const socket = getSocket()
    if (socket && state.meetingId) {
      socket.emit('toggle-media', state.meetingId, state.localUserId, { isMuted: newMuted })
    }

    get().addEvent({
      type: newMuted ? 'mute' : 'unmute',
      message: newMuted ? 'You muted your microphone' : 'You unmuted your microphone',
    })
  },

  toggleVideo: () => {
    const state = get()
    const newVideoOff = !state.localIsVideoOff
    set((s) => ({
      localIsVideoOff: newVideoOff,
      participants: s.participants.map((p) =>
        p.id === s.localUserId ? { ...p, isVideoOff: newVideoOff } : p
      ),
    }))

    const socket = getSocket()
    if (socket && state.meetingId) {
      socket.emit('toggle-media', state.meetingId, state.localUserId, { isVideoOff: newVideoOff })
    }

    get().addEvent({
      type: newVideoOff ? 'video-off' : 'video-on',
      message: newVideoOff ? 'You turned off your camera' : 'You turned on your camera',
    })
  },

  toggleScreenShare: () => {
    const state = get()
    const newScreenShare = !state.localIsScreenSharing
    set((s) => ({
      localIsScreenSharing: newScreenShare,
      participants: s.participants.map((p) =>
        p.id === s.localUserId ? { ...p, isScreenSharing: newScreenShare } : p
      ),
    }))
    
    const socket = getSocket()
    if (socket && state.meetingId) {
      socket.emit('toggle-media', state.meetingId, state.localUserId, { isScreenSharing: newScreenShare })
    }

    get().addEvent({
      type: 'info',
      message: newScreenShare ? 'You started sharing your screen' : 'You stopped sharing your screen',
    })
  },

  // ── Signaling ─────────────────────────────────────────────────────

  logSignaling: (entry) => {
    set((state) => ({
      signalingLog: [...state.signalingLog, `[${new Date().toISOString()}] ${entry}`],
    }))
  },

  // ── Reset ─────────────────────────────────────────────────────────

  reset: () => set({ ...initialState }),
}))
