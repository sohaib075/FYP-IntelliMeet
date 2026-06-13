import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare, Users, Globe2, PhoneOff, Copy, Signal, XCircle, AlertTriangle, Send, ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useMeetingStore } from "@/store/useMeetingStore"
import { useMeetingConnection } from "@/hooks/useMeetingConnection"
import { useAuthStore } from "@/store/useAuthStore"
import { Logo } from "@/components/common/Logo"
import { getSocket } from "@/lib/socket"

// ─── Helper ────────────────────────────────────────────────────────

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null)
  
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream
    }
  }, [stream])

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className="w-full h-full object-cover absolute inset-0"
    />
  )
}

// ─── Component ──────────────────────────────────────────────────────

export function MeetingRoomPage() {
  const { meetingId } = useParams()
  const navigate = useNavigate()

  // Store
  const {
    status, setStatus, leaveMeeting,
    title, elapsedSeconds,
    participants, messages, unreadCount, events,
    localIsMuted, localIsVideoOff, localIsScreenSharing,
    toggleMic, toggleVideo, toggleScreenShare, sendMessage, clearUnread,
    addEvent, dismissEvent, removeParticipant,
    sourceLang, targetLang, localUserId,
  } = useMeetingStore()

  // Connection hooks
  useMeetingConnection()

  // Local UI state
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

  const pageSize = 6
  const totalPages = Math.ceil(participants.length / pageSize)

  // Reset page index if total pages shrink
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1)
    }
  }, [participants.length, totalPages, currentPage])

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // WebRTC peers & streams
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())

  // ── Meeting Timer Ticking ──
  useEffect(() => {
    if (status !== 'active') return
    const interval = setInterval(() => {
      useMeetingStore.getState().tick()
    }, 1000)
    return () => clearInterval(interval)
  }, [status])

  // ── WebRTC Connection Management ──
  useEffect(() => {
    if (status !== 'active') return

    const socket = getSocket()
    if (!socket) return

    const createPeerConnection = (remoteParticipantId: string, remoteSocketId: string, initiateCall: boolean) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19002' }]
      })

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('signal', {
            to: remoteSocketId,
            signal: { type: 'candidate', candidate: event.candidate }
          })
        }
      }

      pc.ontrack = (event) => {
        setRemoteStreams((prev) => {
          const newMap = new Map(prev)
          newMap.set(remoteParticipantId, event.streams[0])
          return newMap
        })
      }

      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream))
      }

      if (initiateCall) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit('signal', {
              to: remoteSocketId,
              signal: { type: 'offer', sdp: pc.localDescription }
            })
          })
          .catch((err) => console.error("Error creating offer", err))
      }

      peersRef.current.set(remoteParticipantId, pc)
      return pc
    }

    // Handle signal messages from peers
    const onSignal = async ({ from, signal }: { from: string; signal: any }) => {
      const peer = participants.find(p => p.socketId === from)
      if (!peer) return

      let pc = peersRef.current.get(peer.id)
      if (!pc) {
        pc = createPeerConnection(peer.id, from, false)
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('signal', {
            to: from,
            signal: { type: 'answer', sdp: pc.localDescription }
          })
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        } else if (signal.type === 'candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
        }
      } catch (err) {
        console.error("Error handling signal", err)
      }
    }

    // Update track senders when local stream changes
    peersRef.current.forEach((pc) => {
      if (stream) {
        const senders = pc.getSenders()
        stream.getTracks().forEach((track) => {
          const sender = senders.find((s) => s.track?.kind === track.kind)
          if (sender) {
            sender.replaceTrack(track)
          } else {
            pc.addTrack(track, stream)
          }
        })
      }
    })

    // Establish connections with participants
    const activeParticipants = participants.filter(p => p.id !== localUserId)
    activeParticipants.forEach((p) => {
      if (!peersRef.current.has(p.id) && p.socketId) {
        // Deterministic caller selection (lexicographical comparison of IDs)
        const initiateCall = localUserId ? (localUserId < p.id) : false
        createPeerConnection(p.id, p.socketId, initiateCall)
      }
    })

    socket.on('signal', onSignal)

    return () => {
      socket.off('signal', onSignal)
    }
  }, [status, participants, stream, localUserId])

  // Clean up peers that left
  useEffect(() => {
    const participantIds = new Set(participants.map(p => p.id))
    peersRef.current.forEach((pc, peerId) => {
      if (!participantIds.has(peerId)) {
        pc.close()
        peersRef.current.delete(peerId)
        setRemoteStreams((prev) => {
          const newMap = new Map(prev)
          newMap.delete(peerId)
          return newMap
        })
      }
    })
  }, [participants])

  // ── Activate meeting on mount ─────────────────────────────────────

  useEffect(() => {
    // If status is 'connecting' (set by lobby), transition to 'active' after a brief delay
    if (status === 'connecting') {
      const timer = setTimeout(() => setStatus('active'), 800)
      return () => clearTimeout(timer)
    }
    // If user navigated directly (no lobby), set up a default meeting
    if (status === 'idle') {
      const { joinMeeting } = useMeetingStore.getState()
      const authUser = useAuthStore.getState().user
      joinMeeting({
        meetingId: meetingId || 'direct-join',
        title: 'CPEC Quarterly Review',
        userName: authUser?.name || 'Guest',
        sourceLang: authUser?.preferences?.sourceLanguage || 'en',
        targetLang: authUser?.preferences?.targetLanguage || 'en',
        micOn: true,
        videoOn: true,
      })
      setTimeout(() => setStatus('active'), 800)
    }
  }, [status, setStatus, meetingId])

  // ── Camera & Mic ──────────────────────────────────────────────────

  useEffect(() => {
    let activeStream: MediaStream | null = null

    const initMedia = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        activeStream = mediaStream
        setStream(mediaStream)
      } catch (err) {
        console.warn("Failed to get both video and audio in room, trying fallbacks...", err)
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          activeStream = audioStream
          setStream(audioStream)
        } catch (audioErr) {
          console.warn("Failed to get audio stream in room:", audioErr)
          try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
            activeStream = videoStream
            setStream(videoStream)
          } catch (videoErr) {
            console.error("Failed to get any media device in room:", videoErr)
          }
        }
      }
    }

    initMedia()

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Safely bind the local stream to the video element whenever it is rendered
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream, localIsVideoOff])

  useEffect(() => {
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !localIsVideoOff)
    }
  }, [localIsVideoOff, stream])

  useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !localIsMuted)
    }
  }, [localIsMuted, stream])

  // ── Auto Scroll Chat ──────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeTab])

  // ── Actions ───────────────────────────────────────────────────────

  const toggleSidebar = (tab: "chat" | "participants") => {
    if (isSidebarOpen && activeTab === tab) {
      setIsSidebarOpen(false)
    } else {
      setIsSidebarOpen(true)
      setActiveTab(tab)
      if (tab === "chat") {
        clearUnread()
      }
    }
  }

  const handleSendMessage = () => {
    if (!chatInput.trim()) return
    sendMessage(chatInput.trim())
    setChatInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage()
    }
  }

  const handleEndCall = () => {
    leaveMeeting()
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    navigate('/meeting/ended')
  }

  const handleRemoveParticipant = () => {
    if (!removeTarget) return
    const targetName = participants.find(p => p.id === removeTarget)?.name || 'Participant'
    removeParticipant(removeTarget)
    addEvent({
      type: 'leave',
      message: `${targetName} was removed from the meeting by Host.`,
    })
    setShowRemoveModal(false)
    setRemoveTarget(null)
  }

  // ── Derived data ──────────────────────────────────────────────────

  const localUser = participants.find(p => p.id === localUserId)
  const remoteParticipants = participants.filter(p => p.id !== localUserId)
  const activeSpeaker = remoteParticipants[0] // First remote participant is "active speaker"

  const langMap: Record<string, { flag: string; name: string }> = {
    en: { flag: '🇬🇧', name: 'English' },
    ur: { flag: '🇵🇰', name: 'Urdu' },
    zh: { flag: '🇨🇳', name: 'Chinese' },
  }
  const srcLang = langMap[sourceLang] || langMap.en
  const tgtLang = langMap[targetLang] || langMap.zh
  const hasVideo = !!(stream && stream.getVideoTracks().length > 0)

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-body overflow-hidden">
      
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 relative min-w-0">
        
        {/* Top Bar */}
        <div className="h-[52px] bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)] grid grid-cols-3 items-center px-4 z-10 shrink-0 shadow-md">
          {/* Left Column: Logo, Title, ID */}
          <div className="flex items-center gap-3 min-w-0">
            <Logo size={24} className="text-white shrink-0" />
            <div className="h-4 w-[1px] bg-[var(--color-border-default)] shrink-0 hidden sm:block" />
            <span className="text-[var(--color-text-primary)] text-[14px] font-semibold truncate max-w-[80px] sm:max-w-none">{title || 'CPEC Quarterly Review'}</span>
            <div className="flex items-center gap-1.5 ml-2 shrink-0">
              <span className="text-[var(--color-text-secondary)] font-mono text-[11px] sm:text-[12px] truncate max-w-[80px] sm:max-w-none">{meetingId || "intellimeet-xk7a-2b9c"}</span>
              <button 
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-border-hover)] transition-colors"
                onClick={() => navigator.clipboard.writeText(meetingId || '')}
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
          
          {/* Center Column: Timer */}
          <div className="flex justify-center items-center">
            <span className="text-[var(--color-text-primary)] font-mono text-[14px] sm:text-[16px] font-semibold tracking-wider bg-[var(--color-bg-primary)]/40 px-2 py-0.5 rounded">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>

          {/* Right Column: Actions */}
          <div className="flex items-center justify-end gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center text-[#10B981]" title="Good Network Quality">
              <Signal className="h-4 w-4" />
            </div>
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors p-1"
            >
              <Globe2 className="h-5 w-5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-[var(--color-surface-light)] text-[var(--color-brand-blue)] flex items-center justify-center text-xs font-bold uppercase border border-white/5 shrink-0">
              {localUser?.initials || '??'}
            </div>
          </div>
        </div>

        {/* In-Meeting Event Notifications */}
        <div className="absolute top-[60px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
          <AnimatePresence>
            {events.slice(-2).map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="bg-[var(--color-surface-card)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] rounded-lg px-4 py-2 shadow-lg pointer-events-auto w-full text-center"
              >
                <span className="text-[13px] font-medium block truncate">
                  {event.type === 'join' && '👋 '}
                  {event.type === 'leave' && '🚪 '}
                  {event.type === 'mute' && '🔇 '}
                  {event.type === 'unmute' && '🔊 '}
                  {event.type === 'video-off' && '📷 '}
                  {event.type === 'video-on' && '🎥 '}
                  {event.message}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {/* Video Grid Area */}
        <div className="flex-1 relative p-6 flex flex-col items-center justify-center overflow-hidden bg-[var(--color-bg-primary)] pb-24">
          
          {localIsScreenSharing ? (
            <div className="w-full h-full max-w-6xl relative bg-[var(--color-surface-card)] rounded-2xl overflow-hidden border border-[var(--color-border-default)] shadow-lg flex flex-col">
              {/* Header */}
              <div className="bg-black/50 px-4 py-2.5 flex items-center justify-between border-b border-[var(--color-border-default)]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-[12px] font-medium text-white truncate">You are sharing your screen</span>
                </div>
                <button 
                  onClick={toggleScreenShare}
                  className="bg-[#EF4444] hover:bg-[#D92626] text-white text-[11px] font-semibold px-2.5 py-1 rounded transition-colors"
                >
                  Stop Presenting
                </button>
              </div>
              {/* Screen simulation content */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-slate-950/60 relative">
                <div className="w-full max-w-md p-6 bg-slate-900/95 rounded-xl border border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-md">
                  <div className="absolute top-0 right-0 h-20 w-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-xl" />
                  <Logo size={32} className="text-white mx-auto mb-4" />
                  <h3 className="text-[15px] font-bold text-white mb-1">CPEC Quarterly Financial Review</h3>
                  <p className="text-[11px] text-slate-400 mb-4 font-mono">Presenting window: Chrome Tab</p>
                  
                  {/* Simulated bar chart */}
                  <div className="flex items-end justify-center gap-2 h-20 mt-2 mb-4">
                    <div className="w-5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t h-[40%] animate-pulse" />
                    <div className="w-5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t h-[75%] animate-pulse delay-75" />
                    <div className="w-5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t h-[60%] animate-pulse delay-150" />
                    <div className="w-5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t h-[95%] animate-pulse delay-200" />
                    <div className="w-5 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t h-[50%] animate-pulse delay-300" />
                  </div>
                  
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-800/30">
                    Real-time translation active: {srcLang.name} ⇄ {tgtLang.name}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full max-w-5xl max-h-[calc(100vh-180px)] relative flex items-center justify-center p-2">
              
              {/* Pagination Left Button */}
              {totalPages > 1 && (
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className="absolute left-0 z-30 p-3 rounded-full bg-[var(--color-bg-secondary)]/85 border border-[var(--color-border-default)] text-white hover:bg-[var(--color-brand-blue)] hover:border-[var(--color-brand-blue)] transition-all disabled:opacity-35 disabled:hover:bg-[var(--color-bg-secondary)]/85 disabled:hover:border-[var(--color-border-default)] shadow-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              {/* Grid Container */}
              <div 
                className={`grid gap-4 w-full h-full px-12 transition-all duration-300 ${
                  (() => {
                    const count = participants.slice(currentPage * pageSize, (currentPage + 1) * pageSize).length;
                    if (count === 1) return 'grid-cols-1 max-w-3xl';
                    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
                    if (count === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
                    if (count === 4) return 'grid-cols-2';
                    return 'grid-cols-2 lg:grid-cols-3';
                  })()
                }`}
                style={{
                  gridTemplateRows: (() => {
                    const count = participants.slice(currentPage * pageSize, (currentPage + 1) * pageSize).length;
                    if (count === 1) return '1fr';
                    if (count <= 3) return 'repeat(auto-fit, minmax(0, 1fr))';
                    return 'repeat(2, minmax(0, 1fr))';
                  })()
                }}
              >
                <AnimatePresence mode="popLayout">
                  {participants.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((p) => {
                    const isLocal = p.id === localUserId
                    return (
                      <motion.div 
                        layout
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`relative w-full h-full rounded-2xl overflow-hidden bg-[var(--color-surface-card)] border-2 transition-all duration-300 flex items-center justify-center shadow-lg min-h-0 min-w-0 ${
                          !p.isMuted && !p.isVideoOff ? 'border-[var(--color-success)]/40 shadow-[var(--color-success)]/5' : 'border-[var(--color-border-default)]'
                        } hover:border-[var(--color-border-hover)] group`}
                      >
                        {isLocal ? (
                          // Local video card
                          (!localIsVideoOff && hasVideo) ? (
                            <video 
                              ref={videoRef} 
                              autoPlay 
                              playsInline 
                              muted 
                              className="w-full h-full object-cover transform -scale-x-100 absolute inset-0" 
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-3 z-10 p-4">
                              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[var(--color-surface-light)] text-[var(--color-brand-blue)] border-2 border-[var(--color-brand-blue)]/25 flex items-center justify-center text-xl sm:text-2xl font-bold uppercase shadow-inner shrink-0">
                                {p.initials}
                              </div>
                              <span className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] bg-black/45 px-2.5 py-1 rounded-full border border-white/5">
                                {!hasVideo && !localIsVideoOff ? "Camera unavailable" : "Camera is off"}
                              </span>
                            </div>
                          )
                        ) : (
                          // Remote video card
                          (p.isVideoOff || !remoteStreams.get(p.id)) ? (
                            <div className="flex flex-col items-center gap-3 z-10 p-4">
                              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold uppercase shadow-inner border-2 border-white/10 shrink-0" style={{ backgroundColor: p.avatarColor }}>
                                {p.initials}
                              </div>
                              <span className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] bg-black/45 px-2.5 py-1 rounded-full border border-white/5">
                                {p.isVideoOff ? "Camera is off" : "Connecting video..."}
                              </span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center overflow-hidden">
                              <RemoteVideo stream={remoteStreams.get(p.id)!} />
                            </div>
                          )
                        )}

                        {/* Participant Details Overlay */}
                        <div className="absolute bottom-3 left-3 bg-black/60 border border-white/5 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center gap-2 text-white z-20">
                          <span className="text-[11px] sm:text-[12px] font-semibold truncate max-w-[100px] sm:max-w-[140px]">{p.name} {isLocal && '(You)'}</span>
                          {p.isHost && (
                            <span className="bg-[var(--color-host)]/20 text-[var(--color-host)] border border-[var(--color-host)]/30 rounded text-[9px] px-1 font-bold">
                              HOST
                            </span>
                          )}
                        </div>

                        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                          <div className="bg-black/75 rounded-full px-2 py-0.5 flex items-center gap-1 border border-white/5 shadow-sm">
                            <span className="text-[10px] sm:text-[11px]">{p.flag}</span>
                            <span className="text-[8px] sm:text-[9px] text-[var(--color-text-secondary)] font-medium uppercase tracking-wider hidden xs:inline">{p.language}</span>
                          </div>
                        </div>

                        {p.isMuted && (
                          <div className="absolute bottom-3 right-3 h-7 w-7 rounded-full bg-[#EF4444] flex items-center justify-center shadow-lg z-25 border border-white/10">
                            <MicOff className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>

              {/* Pagination Right Button */}
              {totalPages > 1 && (
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="absolute right-0 z-30 p-3 rounded-full bg-[var(--color-bg-secondary)]/85 border border-[var(--color-border-default)] text-white hover:bg-[var(--color-brand-blue)] hover:border-[var(--color-brand-blue)] transition-all disabled:opacity-35 disabled:hover:bg-[var(--color-bg-secondary)]/85 disabled:hover:border-[var(--color-border-default)] shadow-lg"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

              {/* Page indicator dot indicators at bottom of grid */}
              {totalPages > 1 && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`h-2 rounded-full transition-all duration-300 ${i === currentPage ? 'w-5 bg-[var(--color-brand-blue)]' : 'w-2 bg-[var(--color-border-default)] hover:bg-[var(--color-text-secondary)]'}`}
                    />
                  ))}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Translation Status Badge */}
        <div className={`absolute top-[68px] ${isSidebarOpen ? 'right-[340px]' : 'right-6'} bg-[var(--color-surface-card)] border border-[var(--color-border-default)] rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-lg z-20 transition-all text-[var(--color-text-primary)] hidden sm:flex`}>
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-blue)] animate-pulse" />
          <span className="text-[12px] font-semibold tracking-wide">{srcLang.flag} {srcLang.name} → {tgtLang.flag} {tgtLang.name}</span>
        </div>

        {/* Floating Language Menu */}
        {showLangMenu && (
          <div className="absolute bottom-[88px] left-1/2 -translate-x-1/2 bg-[var(--color-surface-card)] border border-[var(--color-border-default)] rounded-xl p-4 shadow-2xl z-30 min-w-[280px]">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[var(--color-border-default)]">
              <h4 className="text-[13px] font-bold text-white flex items-center gap-1.5">
                <Globe2 className="h-4 w-4 text-[var(--color-brand-blue)]" />
                Translation Settings
              </h4>
              <button 
                onClick={() => setShowLangMenu(false)}
                className="text-[var(--color-text-secondary)] hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">My Spoken Language</label>
                <select 
                  value={sourceLang}
                  onChange={(e) => {
                    useMeetingStore.setState({ sourceLang: e.target.value })
                  }}
                  className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg p-2 text-xs text-white focus:outline-none"
                >
                  <option value="en">🇬🇧 English</option>
                  <option value="ur">🇵🇰 Urdu</option>
                  <option value="zh">🇨🇳 Chinese</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Translate To (Captions)</label>
                <select 
                  value={targetLang}
                  onChange={(e) => {
                    useMeetingStore.setState({ targetLang: e.target.value })
                  }}
                  className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg p-2 text-xs text-white focus:outline-none"
                >
                  <option value="en">🇬🇧 English</option>
                  <option value="ur">🇵🇰 Urdu</option>
                  <option value="zh">🇨🇳 Chinese</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Floating Bottom Control Bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--color-bg-secondary)]/90 backdrop-blur-md border border-[var(--color-border-default)] rounded-2xl flex items-center justify-center px-6 py-2.5 shrink-0 z-30 shadow-2xl">
          <div className="flex items-center gap-1 sm:gap-2 max-w-full">
            
            <button 
              onClick={toggleMic}
              className={`w-[48px] sm:w-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-[var(--color-surface-light)] transition-colors py-1 shrink-0 focus:outline-none ${localIsMuted ? 'text-[#EF4444]' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
            >
              {localIsMuted ? <MicOff className="h-4 sm:h-5 w-4 sm:w-5" /> : <Mic className="h-4 sm:h-5 w-4 sm:w-5" />}
              <span className="text-[9px] font-medium">{localIsMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button 
              onClick={toggleVideo}
              className={`w-[48px] sm:w-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-[var(--color-surface-light)] transition-colors py-1 shrink-0 focus:outline-none ${localIsVideoOff ? 'text-[#EF4444]' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
            >
              {localIsVideoOff ? <VideoOff className="h-4 sm:h-5 w-4 sm:w-5" /> : <Video className="h-4 sm:h-5 w-4 sm:w-5" />}
              <span className="text-[9px] font-medium">{localIsVideoOff ? 'Start Cam' : 'Stop Cam'}</span>
            </button>

            <button 
              onClick={toggleScreenShare}
              className={`w-[48px] sm:w-[52px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors py-1 shrink-0 focus:outline-none ${localIsScreenSharing ? 'bg-[var(--color-brand-blue)]/20 text-[var(--color-brand-blue)]' : 'hover:bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:text-white'}`}
            >
              <MonitorUp className="h-4 sm:h-5 w-4 sm:w-5" />
              <span className="text-[9px] font-medium">Share</span>
            </button>

            <button 
              onClick={() => toggleSidebar("chat")}
              className={`w-[48px] sm:w-[52px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors py-1 relative shrink-0 focus:outline-none ${isSidebarOpen && activeTab === "chat" ? 'bg-[var(--color-brand-blue)]/20 text-[var(--color-brand-blue)]' : 'hover:bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:text-white'}`}
            >
              <MessageSquare className="h-4 sm:h-5 w-4 sm:w-5" />
              <span className="text-[9px] font-medium">Chat</span>
              {unreadCount > 0 && (
                <div className="absolute top-0 right-1 h-4 min-w-[16px] bg-[#EF4444] rounded-full border-2 border-[var(--color-surface-card)] text-[8px] text-white flex items-center justify-center font-bold px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
            </button>

            <button 
              onClick={() => toggleSidebar("participants")}
              className={`w-[48px] sm:w-[52px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors py-1 relative shrink-0 focus:outline-none ${isSidebarOpen && activeTab === "participants" ? 'bg-[var(--color-brand-blue)]/20 text-[var(--color-brand-blue)]' : 'hover:bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:text-white'}`}
            >
              <Users className="h-4 sm:h-5 w-4 sm:w-5" />
              <span className="text-[9px] font-medium">People</span>
              <div className="absolute top-0 right-1 bg-[var(--color-surface-light)] rounded-full px-1 border-2 border-[var(--color-surface-card)] text-[8px] flex items-center justify-center font-bold text-[var(--color-text-secondary)]">
                {participants.length}
              </div>
            </button>

            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className={`w-[48px] sm:w-[52px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors py-1 shrink-0 focus:outline-none ${showLangMenu ? 'bg-[var(--color-brand-blue)]/20 text-[var(--color-brand-blue)]' : 'hover:bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:text-white'}`}
            >
              <Globe2 className="h-4 sm:h-5 w-4 sm:w-5" />
              <span className="text-[9px] font-medium">Lang</span>
            </button>

            <div className="w-[1px] h-8 bg-[var(--color-border-default)] mx-1 sm:mx-2 shrink-0" />

            <button 
              onClick={handleEndCall}
              className="w-[48px] sm:w-[52px] flex flex-col items-center justify-center gap-1 rounded-xl bg-[#EF4444] hover:bg-[#D92626] transition-colors py-1 text-white ml-1 shadow-md shadow-red-500/10 shrink-0 focus:outline-none"
            >
              <PhoneOff className="h-4 sm:h-5 w-4 sm:w-5" />
              <span className="text-[9px] font-medium">Leave</span>
            </button>

          </div>
        </div>
      </div>

      {/* Right Panel */}
      {isSidebarOpen && (
        <div className="w-full md:w-[320px] absolute md:relative right-0 top-[52px] md:top-auto bottom-0 md:bottom-auto md:h-full bg-[var(--color-bg-secondary)] border-l border-[var(--color-border-default)] flex flex-col shrink-0 z-40 shadow-2xl md:shadow-none">
          
          {/* Tabs */}
          <div className="flex h-[52px] border-b border-[var(--color-border-default)]">
            <button 
              onClick={() => { setActiveTab("chat"); clearUnread() }}
              className={`flex-1 flex items-center justify-center text-[14px] font-semibold relative focus:outline-none ${activeTab === "chat" ? 'text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
            >
              Chat
              {activeTab === "chat" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-brand-blue)]" />}
            </button>
            <button 
              onClick={() => setActiveTab("participants")}
              className={`flex-1 flex items-center justify-center text-[14px] font-semibold relative focus:outline-none ${activeTab === "participants" ? 'text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
            >
              Participants ({participants.length})
              {activeTab === "participants" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-brand-blue)]" />}
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {activeTab === "chat" ? (
              <>
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-secondary)]">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-50 text-[var(--color-text-muted)]" />
                    <p className="text-[13px] font-medium">No messages yet</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">Be the first to say something!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    msg.isOwn ? (
                      <div key={msg.id} className="flex gap-3 flex-row-reverse">
                        <div className="h-8 w-8 rounded-full bg-[var(--color-surface-light)] text-[var(--color-brand-blue)] border border-white/5 flex items-center justify-center text-xs font-bold shrink-0 mt-1">{msg.senderInitials}</div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-[10px] text-[var(--color-text-secondary)]">{msg.timestamp}</span>
                            <span className="text-[12px] font-semibold text-[var(--color-text-secondary)]">You</span>
                          </div>
                          <div className="bg-[var(--color-brand-blue)] text-white text-[14px] px-3.5 py-2.5 rounded-xl rounded-tr-sm inline-block shadow-sm max-w-[220px]">
                            {msg.message}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={msg.id} className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] border border-white/5 flex items-center justify-center text-xs font-bold shrink-0 mt-1">{msg.senderInitials}</div>
                        <div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-[12px] font-semibold text-white">{msg.senderName}</span>
                            <span className="text-[10px] text-[var(--color-text-secondary)]">{msg.timestamp}</span>
                          </div>
                          <div className="bg-[var(--color-surface-card)] text-white text-[14px] px-3.5 py-2.5 rounded-xl rounded-tl-sm inline-block max-w-[220px] shadow-sm border border-white/5">
                            {msg.message}
                          </div>
                        </div>
                      </div>
                    )
                  ))
                )}
                <div ref={chatEndRef} />
              </>
            ) : (
              <>
                <h3 className="text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">In this meeting ({participants.length})</h3>
                
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 hover:bg-[var(--color-surface-light)] rounded-lg group h-10 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs shrink-0 font-bold" style={{ backgroundColor: p.avatarColor }}>
                        {p.initials}
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[14px] font-semibold text-white truncate">{p.name}</span>
                        {p.id === localUserId && <span className="text-[12px] text-[var(--color-text-secondary)] shrink-0">(You)</span>}
                        {p.isHost && <span className="text-[10px] text-[var(--color-host)] bg-[var(--color-host)]/15 border border-[var(--color-host)]/20 px-1.5 py-0.5 rounded shrink-0 font-bold">HOST</span>}
                        {!p.isHost && <span className="text-[16px] shrink-0">{p.flag}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        {p.isMuted ? <MicOff className="h-4 w-4 text-[#EF4444]" /> : <Mic className="h-4 w-4" />}
                        {p.isVideoOff ? <VideoOff className="h-4 w-4 text-[#EF4444]" /> : <Video className="h-4 w-4" />}
                      </div>
                      {/* Host Actions (only for remote participants) */}
                      {p.id !== localUserId && (
                        <div className="hidden group-hover:flex items-center gap-1 ml-1 pl-2 border-l border-[var(--color-border-default)]">
                          <button className="h-7 w-7 rounded flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                            <MicOff className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => { setRemoveTarget(p.id); setShowRemoveModal(true) }}
                            className="h-7 w-7 rounded flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Chat Input */}
          {activeTab === "chat" && (
            <div className="p-3 border-t border-[var(--color-border-default)]">
              <div className="relative">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message everyone..." 
                  className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg pl-3 pr-10 py-2.5 text-[14px] text-white focus:outline-none focus:border-[var(--color-border-hover)] placeholder:text-[var(--color-text-muted)]"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 bg-[var(--color-brand-blue)] rounded-full flex items-center justify-center text-white hover:bg-[var(--color-brand-blue-hover)] transition-colors disabled:opacity-40 disabled:hover:bg-[var(--color-brand-blue)]"
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          
          {/* Invite Button */}
          {activeTab === "participants" && (
             <div className="p-3 border-t border-[var(--color-border-default)]">
                <button 
                  onClick={() => navigator.clipboard.writeText(`https://intellimeet.app/join/${meetingId}`)}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--color-surface-light)] border border-[var(--color-border-default)] hover:bg-[var(--color-surface-card)] text-[var(--color-brand-blue)] text-[13px] py-2.5 rounded-lg transition-colors font-semibold shadow-sm"
                >
                  <Users className="h-4 w-4" />
                  Copy Invite Link
                </button>
             </div>
          )}

        </div>
      )}

      {/* Remove Participant Modal */}
      {showRemoveModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-surface-card)] border border-[var(--color-border-default)] rounded-[16px] w-full max-w-[480px] p-[32px] relative shadow-2xl mx-4">
            <button 
              onClick={() => { setShowRemoveModal(false); setRemoveTarget(null) }}
              className="absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-white focus:outline-none"
            >
              <XCircle className="h-5 w-5" />
            </button>
            
            <div className="flex flex-col items-center text-center">
              <div className="h-10 w-10 bg-[#D97706]/10 rounded-[8px] flex items-center justify-center mb-4 border border-[#D97706]/20">
                <AlertTriangle className="h-5 w-5 text-[#D97706]" />
              </div>
              
              <h2 className="text-[20px] font-semibold text-white mb-2 font-display">
                Remove {participants.find(p => p.id === removeTarget)?.name || 'Participant'}?
              </h2>
              
              <p className="text-[14px] text-[var(--color-text-secondary)] leading-[1.6] max-w-[360px] mb-6">
                {participants.find(p => p.id === removeTarget)?.name || 'This participant'} will be immediately disconnected from this meeting. They won't be able to rejoin unless you invite them again.
              </p>
              
              <div className="w-full flex items-center gap-2 mb-6 justify-center">
                <input type="checkbox" id="prevent-rejoin" className="rounded border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-brand-blue)] focus:ring-[var(--color-brand-blue)]/20" />
                <label htmlFor="prevent-rejoin" className="text-[14px] text-[var(--color-text-secondary)] cursor-pointer select-none">Also prevent this participant from rejoining</label>
              </div>
              
              <div className="w-full flex items-center justify-end gap-3">
                <button 
                  onClick={() => { setShowRemoveModal(false); setRemoveTarget(null) }}
                  className="h-10 px-4 rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-[14px] font-medium hover:bg-[var(--color-surface-light)] transition-colors focus:outline-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRemoveParticipant}
                  className="h-10 px-4 rounded-[8px] bg-[#EF4444] text-white text-[14px] font-medium hover:bg-[#D92626] transition-colors focus:outline-none shadow-md shadow-red-500/10"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
