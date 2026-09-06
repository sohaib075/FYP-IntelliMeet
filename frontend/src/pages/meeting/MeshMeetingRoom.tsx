import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare, Users, Globe2, PhoneOff, Copy, Signal, XCircle, AlertTriangle, Send, ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useMeetingStore } from "@/store/useMeetingStore"
import { useMeetingConnection } from "@/hooks/useMeetingConnection"
import { useAuthStore } from "@/store/useAuthStore"
import { Logo } from "@/components/common/Logo"
import { getSocket } from "@/lib/socket"
import { meetingLink } from "@/lib/meetingId"

// ─── Helper ────────────────────────────────────────────────────────

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function RemoteVideo({ stream, className }: { stream: MediaStream, className?: string }) {
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
      className={className || "w-full h-full object-cover absolute inset-0"}
    />
  )
}

// ─── Component ──────────────────────────────────────────────────────

export function MeshMeetingRoom() {
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
  const [banOnRemove, setBanOnRemove] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  // Host-only leave/end modal (Google Meet-style)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [endCallError, setEndCallError] = useState<string | null>(null)

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
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [isDeviceInitDone, setIsDeviceInitDone] = useState(false)
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

    const createPeerConnection = (remoteParticipantId: string, remoteSocketId: string, isPolite: boolean) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      
      const pcAny = pc as any;
      pcAny.isPolite = isPolite;
      pcAny.makingOffer = false;
      pcAny.ignoreOffer = false;

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('signal', {
            to: remoteSocketId,
            signal: { type: 'candidate', candidate: event.candidate }
          })
        }
      }

      pc.onnegotiationneeded = async () => {
        try {
          pcAny.makingOffer = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('signal', {
            to: remoteSocketId,
            signal: { type: 'offer', sdp: pc.localDescription }
          })
        } catch (err) {
          console.error("Error in negotiation", err)
        } finally {
          pcAny.makingOffer = false;
        }
      }

      pc.ontrack = (event) => {
        setRemoteStreams((prev) => {
          const newMap = new Map(prev)
          // Clone the stream to ensure a new object reference. 
          // If audio arrives after video, creating a new stream forces React to re-bind srcObject!
          const newStream = new MediaStream(event.streams[0].getTracks())
          newMap.set(remoteParticipantId, newStream)
          return newMap
        })
      }

      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream))
      }

      peersRef.current.set(remoteParticipantId, pc)
      return pc
    }

    // Handle signal messages from peers
    const onSignal = async ({ from, signal }: { from: string; signal: any }) => {
      const latestParticipants = useMeetingStore.getState().participants
      const peer = latestParticipants.find(p => p.socketId === from)
      if (!peer) return

      let pc = peersRef.current.get(peer.id)
      if (!pc) {
        const isPolite = localUserId ? (localUserId > peer.id) : true;
        pc = createPeerConnection(peer.id, from, isPolite)
      }

      const pcAny = pc as any;

      try {
        if (signal.type === 'offer') {
          const offerCollision = pcAny.makingOffer || pc.signalingState !== 'stable';
          pcAny.ignoreOffer = !pcAny.isPolite && offerCollision;
          if (pcAny.ignoreOffer) {
            return;
          }

          if (offerCollision) {
            try {
              await pc.setLocalDescription({ type: 'rollback' });
            } catch (e) {
              console.warn("Rollback failed or not supported, proceeding anyway", e);
            }
          }

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
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
          } catch(e) {
            if (!pcAny.ignoreOffer) console.error("Error adding candidate", e)
          }
        }
      } catch (err) {
        console.error("Error handling signal", err)
      }
    }

    // Update track senders when local stream or screen share changes
    peersRef.current.forEach((pc) => {
      const currentVideoTrack = (localIsScreenSharing && screenStream 
        ? screenStream.getVideoTracks()[0] 
        : stream?.getVideoTracks()[0]) || null;
        
      const currentAudioTrack = stream?.getAudioTracks()[0] || null;

      const senders = pc.getSenders();
      const transceivers = pc.getTransceivers();
      
      const isSending = (t: RTCRtpTransceiver) => 
        t.direction === 'sendrecv' || t.direction === 'sendonly' || 
        t.currentDirection === 'sendrecv' || t.currentDirection === 'sendonly';

      let activeVideoSender = senders.find(s => s.track?.kind === 'video');
      if (!activeVideoSender) {
        const t = transceivers.find(t => t.receiver?.track?.kind === 'video');
        if (t && isSending(t)) activeVideoSender = t.sender;
      }

      if (activeVideoSender) {
        activeVideoSender.replaceTrack(currentVideoTrack).catch(e => console.error("Video replaceTrack error:", e));
      } else if (currentVideoTrack && stream) {
        try {
          pc.addTrack(currentVideoTrack, stream);
        } catch (e) {
          console.warn("Could not add video track", e);
        }
      }

      let activeAudioSender = senders.find(s => s.track?.kind === 'audio');
      if (!activeAudioSender) {
        const t = transceivers.find(t => t.receiver?.track?.kind === 'audio');
        if (t && isSending(t)) activeAudioSender = t.sender;
      }

      if (activeAudioSender) {
        activeAudioSender.replaceTrack(currentAudioTrack).catch(e => console.error("Audio replaceTrack error:", e));
      } else if (currentAudioTrack && stream) {
        try {
          pc.addTrack(currentAudioTrack, stream);
        } catch (e) {
          console.warn("Could not add audio track", e);
        }
      }
    })

    // Establish connections with participants
    const activeParticipants = participants.filter(p => p.id !== localUserId)
    activeParticipants.forEach((p) => {
      if (!peersRef.current.has(p.id) && p.socketId) {
        // Deterministic polite selection (lexicographical comparison of IDs)
        const isPolite = localUserId ? (localUserId > p.id) : true
        createPeerConnection(p.id, p.socketId, isPolite)
      }
    })

    socket.on('signal', onSignal)

    return () => {
      socket.off('signal', onSignal)
    }
  }, [status, participants, stream, screenStream, localIsScreenSharing, localUserId, isDeviceInitDone])

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
    // Direct navigation (no lobby): NEVER join blindly. Send the user to the
    // lobby, which validates the meeting against the server first. A wrong
    // code shows "Meeting not found" there instead of creating a room.
    if (status === 'idle') {
      navigate(meetingId ? `/meet/${meetingId}` : '/dashboard', { replace: true })
    }
  }, [status, setStatus, meetingId, navigate])

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
      } finally {
        setIsDeviceInitDone(true)
      }
    }

    initMedia()

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Safely bind the local stream to the video element (handled via callback ref now)

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

  const handleScreenShareToggle = async () => {
    if (localIsScreenSharing) {
      if (screenStream) {
        const tracks = screenStream.getTracks();
        tracks.forEach(track => {
          track.onended = null;
          track.stop();
        })
        setScreenStream(null)
      }
      toggleScreenShare()
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        setScreenStream(displayStream)
        
        displayStream.getVideoTracks()[0].onended = () => {
          setScreenStream(null)
          useMeetingStore.getState().toggleScreenShare()
        }
        
        toggleScreenShare()
      } catch (err) {
        console.error("Failed to share screen", err)
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

  // ── Shared media cleanup ─────────────────────────────────────────
  const stopAllLocalMedia = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop())
    }
    // Close all peer connections
    peersRef.current.forEach(pc => pc.close())
    peersRef.current.clear()
    setRemoteStreams(new Map())
  }

  // ── "Leave Meeting" — host leaves, meeting continues ─────────────
  const handleLeaveCall = () => {
    const socket = getSocket()
    const otherParticipants = participants.filter(p => p.id !== localUserId)

    if (localUser?.isHost && otherParticipants.length === 0) {
      // Host is the only one left — treat this as ending the meeting
      // to avoid a ghost empty room. (Only the host may end; a lone
      // participant simply leaves and the meeting stays joinable.)
      handleEndCallForEveryone()
      return
    }

    // Emit explicit leave-room so backend keeps meeting alive
    if (socket && meetingId && localUserId) {
      socket.emit('leave-room', meetingId, localUserId)
    }

    stopAllLocalMedia()
    leaveMeeting()
    navigate('/meeting/ended?reason=left')
  }

  // ── "End Call for Everyone" — emit end-meeting directly ─────────
  const handleEndCallForEveryone = () => {
    setShowLeaveModal(false)
    const socket = getSocket()
    if (socket && meetingId && localUserId) {
      socket.emit('end-meeting', meetingId, localUserId)
    }
    // Stop our own media eagerly; meeting-ended event handles everyone else
    stopAllLocalMedia()
    leaveMeeting()
    navigate('/meeting/ended')
  }

  // ── Single leave button handler (both host and participant) ───────
  // Host → opens Google Meet-style modal with two options.
  // Participant → leaves immediately (no popup).
  const handleLeaveButtonClick = () => {
    if (localUser?.isHost) {
      setEndCallError(null)
      setShowLeaveModal(true)
    } else {
      handleLeaveCall()
    }
  }

  const handleForceMedia = (targetId: string, action: 'mute' | 'video-off') => {
    const socket = getSocket()
    if (socket && meetingId) {
      socket.emit('force-media', meetingId, targetId, action)
    }
  }

  const handleRemoveParticipant = () => {
    if (!removeTarget) return
    
    const socket = getSocket()
    if (socket && meetingId) {
      // The server verifies we are the host; `ban` blocks re-entry.
      socket.emit('remove-user', meetingId, removeTarget, { ban: banOnRemove })
    }

    const targetName = participants.find(p => p.id === removeTarget)?.name || 'Participant'
    removeParticipant(removeTarget)
    addEvent({
      type: 'leave',
      message: `${targetName} was removed from the meeting by Host.`,
    })
    setShowRemoveModal(false)
    setRemoveTarget(null)
    setBanOnRemove(false)
  }

  // ── Derived data ──────────────────────────────────────────────────

  const localUser = participants.find(p => p.id === localUserId)
  const remoteParticipants = participants.filter(p => p.id !== localUserId)
  
  // Robust fallback: if state somehow lost the host designation, visually assign it to the oldest participant
  const hasHost = participants.some(p => p.isHost);
  const displayParticipants = participants.map((p, index) => {
    if (hasHost) return p;
    return index === 0 ? { ...p, isHost: true } : p;
  });
  
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
            <span className="text-[var(--color-text-primary)] text-[14px] font-semibold truncate max-w-[80px] sm:max-w-none">{title || 'Meeting'}</span>
            <div className="flex items-center gap-1.5 ml-2 shrink-0">
              <span className="text-[var(--color-text-secondary)] font-mono text-[11px] sm:text-[12px] truncate max-w-[80px] sm:max-w-none">{meetingId || ''}</span>
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
          
          {participants.filter(p => p.isScreenSharing).length > 0 ? (
            <div className="w-full h-full max-w-6xl relative bg-[var(--color-surface-card)] rounded-2xl overflow-hidden border border-[var(--color-border-default)] shadow-lg flex flex-col">
              {/* Header */}
              <div className="bg-black/50 px-4 py-2.5 flex items-center justify-between border-b border-[var(--color-border-default)]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-[12px] font-medium text-white truncate">
                    {(() => {
                      const sharers = participants.filter(p => p.isScreenSharing);
                      if (sharers.length === 1) {
                        return sharers[0].id === localUserId ? "You are sharing your screen" : `${sharers[0].name} is sharing their screen`;
                      }
                      return `${sharers.length} participants are sharing their screens`;
                    })()}
                  </span>
                </div>
                {localIsScreenSharing && (
                  <button 
                    onClick={handleScreenShareToggle}
                    className="bg-[#EF4444] hover:bg-[#D92626] text-white text-[11px] font-semibold px-2.5 py-1 rounded transition-colors"
                  >
                    Stop Presenting
                  </button>
                )}
              </div>
              {/* Actual Screen Content */}
              <div className={`flex-1 grid gap-2 p-2 bg-slate-950 relative overflow-hidden ${
                participants.filter(p => p.isScreenSharing).length === 1 ? 'grid-cols-1' : 
                participants.filter(p => p.isScreenSharing).length === 2 ? 'grid-cols-2' : 
                'grid-cols-2 lg:grid-cols-3'
              }`}>
                {participants.filter(p => p.isScreenSharing).map(p => {
                  const isLocal = p.id === localUserId;
                  const streamData = isLocal ? screenStream : remoteStreams.get(p.id);
                  return (
                    <div key={p.id} className="relative bg-black rounded-xl overflow-hidden flex items-center justify-center border border-white/10 w-full h-full">
                      {/* Name badge */}
                      <div className="absolute bottom-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 border border-white/10 shadow-md">
                        <span className="text-white text-[11px] font-medium">{isLocal ? 'You (Presentation)' : `${p.name} (Presentation)`}</span>
                      </div>
                      
                      {streamData ? (
                        isLocal ? (
                          <video 
                            autoPlay 
                            playsInline 
                            muted 
                            className="w-full h-full object-contain absolute inset-0"
                            ref={(el) => { if (el) el.srcObject = streamData }}
                          />
                        ) : (
                          <RemoteVideo stream={streamData} className="w-full h-full object-contain absolute inset-0" />
                        )
                      ) : (
                        <div className="text-slate-400 flex flex-col items-center">
                          <MonitorUp className="h-8 w-8 mb-2 opacity-50" />
                          <p className="text-xs">Loading screen share...</p>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                    const count = displayParticipants.slice(currentPage * pageSize, (currentPage + 1) * pageSize).length;
                    if (count === 1) return 'grid-cols-1 max-w-3xl';
                    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
                    if (count === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
                    if (count === 4) return 'grid-cols-2';
                    return 'grid-cols-2 lg:grid-cols-3';
                  })()
                }`}
                style={{
                  gridTemplateRows: (() => {
                    const count = displayParticipants.slice(currentPage * pageSize, (currentPage + 1) * pageSize).length;
                    if (count === 1) return '1fr';
                    if (count <= 3) return 'repeat(auto-fit, minmax(0, 1fr))';
                    return 'repeat(2, minmax(0, 1fr))';
                  })()
                }}
              >
                <AnimatePresence mode="popLayout">
                  {displayParticipants.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((p) => {
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
                              ref={(el) => {
                                if (el && stream) {
                                  if (el.srcObject !== stream) {
                                    el.srcObject = stream;
                                  }
                                }
                              }}
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
                          <>
                            {remoteStreams.get(p.id) && (
                              <div className={`absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center overflow-hidden transition-opacity duration-300 ${p.isVideoOff ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                <RemoteVideo stream={remoteStreams.get(p.id)!} />
                              </div>
                            )}
                            {(p.isVideoOff || !remoteStreams.get(p.id)) && (
                              <div className="flex flex-col items-center gap-3 z-10 p-4">
                                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold uppercase shadow-inner border-2 border-white/10 shrink-0" style={{ backgroundColor: p.avatarColor }}>
                                  {p.initials}
                                </div>
                                <span className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] bg-black/45 px-2.5 py-1 rounded-full border border-white/5">
                                  {p.isVideoOff ? "Camera is off" : "Connecting video..."}
                                </span>
                              </div>
                            )}
                          </>
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
              onClick={handleScreenShareToggle}
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

            {/* Single leave/end button — same for Host and Participant.
                Host gets a modal; Participant leaves immediately. */}
            <button
              id="leave-meeting-btn"
              onClick={handleLeaveButtonClick}
              className="w-[48px] sm:w-[52px] flex flex-col items-center justify-center gap-1 rounded-xl bg-[#EF4444] hover:bg-[#D92626] active:bg-[#B91C1C] transition-colors py-1 text-white ml-1 shadow-md shadow-red-500/15 shrink-0 focus:outline-none"
              title={localUser?.isHost ? 'Leave or end meeting' : 'Leave meeting'}
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
                      {p.id !== localUserId && localUser?.isHost && (
                        <div className="hidden group-hover:flex items-center gap-1 ml-1 pl-2 border-l border-[var(--color-border-default)]">
                          <button 
                            onClick={() => handleForceMedia(p.id, 'mute')}
                            title="Mute Participant"
                            className="h-7 w-7 rounded flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                          >
                            <MicOff className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleForceMedia(p.id, 'video-off')}
                            title="Turn Off Camera"
                            className="h-7 w-7 rounded flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                          >
                            <VideoOff className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => { setRemoveTarget(p.id); setShowRemoveModal(true) }}
                            title="Remove Participant"
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
                  onClick={() => { if (meetingId) navigator.clipboard.writeText(meetingLink(meetingId)).catch(() => {}) }}
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
                {participants.find(p => p.id === removeTarget)?.name || 'This participant'} will be immediately disconnected from this meeting.
              </p>
              
              <div className="w-full flex items-center gap-2 mb-6 justify-center">
                <input
                  type="checkbox"
                  id="prevent-rejoin"
                  checked={banOnRemove}
                  onChange={(e) => setBanOnRemove(e.target.checked)}
                  className="rounded border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-brand-blue)] focus:ring-[var(--color-brand-blue)]/20"
                />
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

      {/* ── Host Leave / End Meeting — Google Meet-style modal ─────── */}
      {showLeaveModal && (
        // Click outside (backdrop) to dismiss
        <div
          className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowLeaveModal(false) }}
        >
          {/* Dark scrim */}
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

          {/* Modal panel */}
          <div className="relative z-10 w-full sm:max-w-[360px] mx-4 mb-6 sm:mb-0 bg-[var(--color-surface-card)] border border-[var(--color-border-default)] rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-[16px] font-semibold text-white font-display">Leave meeting?</h2>
              <button
                id="leave-modal-close-btn"
                onClick={() => setShowLeaveModal(false)}
                className="h-7 w-7 flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
                aria-label="Close"
              >
                <XCircle className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-[1px] bg-[var(--color-border-default)] mx-5" />

            {/* Options */}
            <div className="flex flex-col gap-2 px-5 py-4">

              {/* ── Leave call — host exits, meeting continues ── */}
              <button
                id="leave-call-btn"
                onClick={() => { setShowLeaveModal(false); handleLeaveCall() }}
                className="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-[var(--color-border-default)] hover:border-amber-500/40 hover:bg-amber-500/5 transition-all duration-150 text-left focus:outline-none"
              >
                <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:bg-amber-500/15 transition-colors">
                  <PhoneOff className="h-5 w-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white leading-tight">Leave call</p>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-snug">
                    Others can continue the meeting
                  </p>
                </div>
              </button>

              {/* ── End call for everyone — destructive ── */}
              <button
                id="end-for-everyone-btn"
                onClick={handleEndCallForEveryone}
                className="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-[#EF4444]/20 hover:border-[#EF4444]/50 bg-[#EF4444]/5 hover:bg-[#EF4444]/10 transition-all duration-150 text-left focus:outline-none"
              >
                <div className="h-10 w-10 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/25 flex items-center justify-center shrink-0 group-hover:bg-[#EF4444]/20 transition-colors">
                  <PhoneOff className="h-5 w-5 text-[#EF4444]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#EF4444] leading-tight">End call for everyone</p>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-snug">
                    All {participants.length} participant{participants.length !== 1 ? 's' : ''} will be disconnected
                  </p>
                </div>
              </button>

            </div>

            {endCallError && (
              <p className="text-[12px] text-[#EF4444] px-5 pb-3 text-center">{endCallError}</p>
            )}

            {/* Cancel */}
            <div className="px-5 pb-5">
              <button
                id="leave-modal-cancel-btn"
                onClick={() => setShowLeaveModal(false)}
                className="w-full h-10 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-[14px] font-medium hover:bg-[var(--color-surface-light)] hover:text-white transition-colors focus:outline-none"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
