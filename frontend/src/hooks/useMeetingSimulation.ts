import { useEffect, useRef, useCallback } from 'react'
import { useMeetingStore, type Participant } from '@/store/useMeetingStore'

// ─── Simulated participant pool ────────────────────────────────────

const SIMULATED_PARTICIPANTS: Omit<Participant, 'joinedAt'>[] = [
  { id: 'sim-ibrahim', name: 'Ibrahim Zahid', initials: 'IZ', avatarColor: '#16A34A', language: 'Chinese', flag: '🇨🇳', isMuted: false, isVideoOff: false, isHost: false },
  { id: 'sim-sarah', name: 'Sarah Jenkins', initials: 'SJ', avatarColor: '#7C3AED', language: 'English', flag: '🇺🇸', isMuted: true, isVideoOff: false, isHost: false },
  { id: 'sim-sohaib', name: 'Muhammad Sohaib', initials: 'MS', avatarColor: '#D97706', language: 'Urdu', flag: '🇵🇰', isMuted: false, isVideoOff: true, isHost: false },
  { id: 'sim-li', name: 'Li Wei', initials: 'LW', avatarColor: '#DC2626', language: 'Chinese', flag: '🇨🇳', isMuted: false, isVideoOff: false, isHost: false },
  { id: 'sim-ahmed', name: 'Ahmed Khan', initials: 'AK', avatarColor: '#0891B2', language: 'Urdu', flag: '🇵🇰', isMuted: true, isVideoOff: false, isHost: false },
]

// ─── Chat message pool ─────────────────────────────────────────────

const CHAT_MESSAGES = [
  { senderId: 'sim-ibrahim', senderName: 'Ibrahim Zahid', senderInitials: 'IZ', message: 'Let me share the Q3 revenue slides' },
  { senderId: 'sim-sarah', senderName: 'Sarah Jenkins', senderInitials: 'SJ', message: 'Can we discuss the timeline adjustments?' },
  { senderId: 'sim-sohaib', senderName: 'Muhammad Sohaib', senderInitials: 'MS', message: 'I\'ve updated the budget document' },
  { senderId: 'sim-ibrahim', senderName: 'Ibrahim Zahid', senderInitials: 'IZ', message: 'The numbers show strong growth in Q3' },
  { senderId: 'sim-li', senderName: 'Li Wei', senderInitials: 'LW', message: 'Phase 2 progress report is ready for review' },
  { senderId: 'sim-sarah', senderName: 'Sarah Jenkins', senderInitials: 'SJ', message: 'I agree, we should prioritize the infrastructure tasks' },
  { senderId: 'sim-ahmed', senderName: 'Ahmed Khan', senderInitials: 'AK', message: 'Translation quality looks excellent today' },
  { senderId: 'sim-ibrahim', senderName: 'Ibrahim Zahid', senderInitials: 'IZ', message: 'Let me pull up the comparison chart' },
  { senderId: 'sim-sohaib', senderName: 'Muhammad Sohaib', senderInitials: 'MS', message: 'Great point about the cross-border metrics' },
  { senderId: 'sim-li', senderName: 'Li Wei', senderInitials: 'LW', message: 'We should schedule a follow-up for next week' },
  { senderId: 'sim-sarah', senderName: 'Sarah Jenkins', senderInitials: 'SJ', message: 'The real-time translation is working perfectly' },
  { senderId: 'sim-ahmed', senderName: 'Ahmed Khan', senderInitials: 'AK', message: 'I can confirm the deployment numbers are accurate' },
]

// ─── Helpers ────────────────────────────────────────────────────────

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

const formatTime = () => {
  const now = new Date()
  return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useMeetingSimulation() {
  const store = useMeetingStore()
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const chatIndexRef = useRef(0)
  const participantIndexRef = useRef(0)
  const isRunning = useRef(false)

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  // ── Elapsed time ticker ───────────────────────────────────────────
  useEffect(() => {
    if (store.status !== 'active') return
    const interval = setInterval(() => {
      store.tick()
    }, 1000)
    return () => clearInterval(interval)
  }, [store.status])

  // ── Main simulation loop ──────────────────────────────────────────
  useEffect(() => {
    if (store.status !== 'active' || isRunning.current) return
    isRunning.current = true

    // Schedule the first batch of participants joining
    const scheduleParticipantJoin = () => {
      if (participantIndexRef.current >= SIMULATED_PARTICIPANTS.length) return
      if (store.status !== 'active') return

      const delay = rand(5000, 12000) // 5-12 seconds
      const timer = setTimeout(() => {
        const currentStore = useMeetingStore.getState()
        if (currentStore.status !== 'active') return
        if (participantIndexRef.current >= SIMULATED_PARTICIPANTS.length) return

        const p = SIMULATED_PARTICIPANTS[participantIndexRef.current]
        participantIndexRef.current++

        currentStore.addParticipant({ ...p, joinedAt: Date.now() })
        currentStore.addEvent({ type: 'join', message: `${p.name} joined the meeting` })

        // Schedule next join
        scheduleParticipantJoin()
      }, delay)
      timersRef.current.push(timer)
    }

    // Schedule chat messages
    const scheduleChatMessage = () => {
      const delay = rand(8000, 20000) // 8-20 seconds
      const timer = setTimeout(() => {
        const currentStore = useMeetingStore.getState()
        if (currentStore.status !== 'active') return

        // Only send messages from participants who are in the meeting
        const remoteParticipants = currentStore.participants.filter((p) => p.id !== 'local-user')
        if (remoteParticipants.length === 0) {
          scheduleChatMessage()
          return
        }

        // Find a message from a participant who is actually in the meeting
        const availableMessages = CHAT_MESSAGES.filter((m) =>
          remoteParticipants.some((p) => p.id === m.senderId)
        )

        if (availableMessages.length === 0) {
          scheduleChatMessage()
          return
        }

        const msgData = availableMessages[chatIndexRef.current % availableMessages.length]
        chatIndexRef.current++

        currentStore.receiveMessage({
          senderId: msgData.senderId,
          senderName: msgData.senderName,
          senderInitials: msgData.senderInitials,
          message: msgData.message,
          timestamp: formatTime(),
        })

        // Schedule next message
        scheduleChatMessage()
      }, delay)
      timersRef.current.push(timer)
    }

    // Schedule random mute/unmute toggles for remote participants
    const scheduleMediaToggle = () => {
      const delay = rand(15000, 35000) // 15-35 seconds
      const timer = setTimeout(() => {
        const currentStore = useMeetingStore.getState()
        if (currentStore.status !== 'active') return

        const remoteParticipants = currentStore.participants.filter((p) => p.id !== 'local-user')
        if (remoteParticipants.length === 0) {
          scheduleMediaToggle()
          return
        }

        const target = remoteParticipants[rand(0, remoteParticipants.length - 1)]
        const toggleType = Math.random() > 0.5 ? 'mic' : 'video'

        if (toggleType === 'mic') {
          const newMuted = !target.isMuted
          currentStore.updateParticipant(target.id, { isMuted: newMuted })
          currentStore.addEvent({
            type: newMuted ? 'mute' : 'unmute',
            message: `${target.name} ${newMuted ? 'muted' : 'unmuted'} their microphone`,
          })
        } else {
          const newVideoOff = !target.isVideoOff
          currentStore.updateParticipant(target.id, { isVideoOff: newVideoOff })
          currentStore.addEvent({
            type: newVideoOff ? 'video-off' : 'video-on',
            message: `${target.name} turned ${newVideoOff ? 'off' : 'on'} their camera`,
          })
        }

        scheduleMediaToggle()
      }, delay)
      timersRef.current.push(timer)
    }

    // Schedule a participant leaving (once, after a long delay)
    const scheduleParticipantLeave = () => {
      const delay = rand(60000, 120000) // 1-2 minutes
      const timer = setTimeout(() => {
        const currentStore = useMeetingStore.getState()
        if (currentStore.status !== 'active') return

        const remoteParticipants = currentStore.participants.filter((p) => p.id !== 'local-user')
        if (remoteParticipants.length <= 1) return // Keep at least one participant

        const target = remoteParticipants[remoteParticipants.length - 1]
        currentStore.removeParticipant(target.id)
        currentStore.addEvent({ type: 'leave', message: `${target.name} left the meeting` })
      }, delay)
      timersRef.current.push(timer)
    }

    // Start all simulation loops
    scheduleParticipantJoin()
    scheduleChatMessage()
    scheduleMediaToggle()
    scheduleParticipantLeave()

    return () => {
      clearAllTimers()
      isRunning.current = false
    }
  }, [store.status, clearAllTimers])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers()
      isRunning.current = false
      participantIndexRef.current = 0
      chatIndexRef.current = 0
    }
  }, [clearAllTimers])
}
