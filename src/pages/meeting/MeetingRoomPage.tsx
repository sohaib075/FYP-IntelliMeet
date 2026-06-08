import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare, Users, Globe2, PhoneOff, Copy, Signal, XCircle, AlertTriangle, Send } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useMeetingStore } from "@/store/useMeetingStore"
import { useMeetingSimulation } from "@/hooks/useMeetingSimulation"
import { useWebRTCSimulation } from "@/hooks/useWebRTCSimulation"

// ─── Helper ────────────────────────────────────────────────────────

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Component ──────────────────────────────────────────────────────

export function MeetingRoomPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Store
  const {
    status, setStatus, leaveMeeting,
    title, elapsedSeconds,
    participants, messages, unreadCount, events,
    localIsMuted, localIsVideoOff,
    toggleMic, toggleVideo, sendMessage, clearUnread,
    addEvent, dismissEvent, removeParticipant,
    sourceLang, targetLang,
  } = useMeetingStore()

  // Simulation hooks
  useMeetingSimulation()
  useWebRTCSimulation()

  // Local UI state
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

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
      joinMeeting({
        meetingId: id || 'direct-join',
        title: 'CPEC Quarterly Review',
        userName: 'Muhammad Usman',
        sourceLang: 'en',
        targetLang: 'zh',
        micOn: true,
        videoOn: true,
      })
      setTimeout(() => setStatus('active'), 800)
    }
  }, [status, setStatus, id])

  // ── Camera & Mic ──────────────────────────────────────────────────

  useEffect(() => {
    let activeStream: MediaStream | null = null
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        activeStream = mediaStream
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      })
      .catch((err) => {
        console.error("Failed to get media devices in room", err)
      })

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

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

  const localUser = participants.find(p => p.id === 'local-user')
  const remoteParticipants = participants.filter(p => p.id !== 'local-user')
  const activeSpeaker = remoteParticipants[0] // First remote participant is "active speaker"

  const langMap: Record<string, { flag: string; name: string }> = {
    en: { flag: '🇬🇧', name: 'English' },
    ur: { flag: '🇵🇰', name: 'Urdu' },
    zh: { flag: '🇨🇳', name: 'Chinese' },
  }
  const srcLang = langMap[sourceLang] || langMap.en
  const tgtLang = langMap[targetLang] || langMap.zh

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] text-[#0F172A] font-body overflow-hidden">
      
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 relative">
        
        {/* Top Bar */}
        <div className="h-[52px] bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 z-10 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-[#3B82F6] text-[14px] font-bold font-display tracking-tight">IntelliMeet</span>
            <div className="h-4 w-[1px] bg-[#E2E8F0]" />
            <span className="text-[#64748B] text-[14px] font-medium">{title || 'CPEC Quarterly Review'}</span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[#94A3B8] font-mono text-[12px]">{id || "intellimeet-xk7a-2b9c"}</span>
              <button 
                className="text-[#64748B] hover:text-[#3B82F6] transition-colors"
                onClick={() => navigator.clipboard.writeText(id || '')}
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
          
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <span className="text-[#0F172A] font-mono text-[16px] font-semibold">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center text-green-500" title="Good Network Quality">
              <Signal className="h-4 w-4" />
            </div>
            <button className="text-[#64748B] hover:text-[#0F172A] transition-colors">
              <Globe2 className="h-5 w-5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center text-xs font-bold uppercase">
              {localUser?.initials || 'MU'}
            </div>
          </div>
        </div>

        {/* In-Meeting Event Notifications */}
        <div className="absolute top-[60px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
          <AnimatePresence>
            {events.slice(-3).map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="bg-white/95 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-4 py-2 shadow-lg pointer-events-auto text-[#334155]"
              >
                <span className="text-[13px] font-medium">
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
        <div className="flex-1 relative p-4 flex gap-4 overflow-hidden">
          
          {/* Active Speaker (Large Tile) */}
          <div className="flex-[7] relative bg-white rounded-xl overflow-hidden border border-[#E2E8F0] shadow-md flex items-center justify-center">
            {activeSpeaker ? (
              <>
                {activeSpeaker.isVideoOff ? (
                  <div className="h-24 w-24 rounded-full flex items-center justify-center text-white text-3xl font-medium" style={{ backgroundColor: activeSpeaker.avatarColor }}>
                    {activeSpeaker.initials}
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-full flex items-center justify-center text-white text-3xl font-medium" style={{ backgroundColor: activeSpeaker.avatarColor }}>
                    {activeSpeaker.initials}
                  </div>
                )}
                <div className="absolute bottom-4 left-4 bg-[#0F172A]/70 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2 text-white">
                  <span className="text-[13px] font-medium">{activeSpeaker.name}</span>
                  {activeSpeaker.isMuted && <MicOff className="h-3 w-3 text-[#DC2626]" />}
                </div>
                <div className="absolute bottom-4 right-4 bg-[#0F172A]/85 rounded-full px-2.5 py-1 flex items-center gap-1.5 border border-[#21262D] text-white">
                  <span className="text-[12px]">{activeSpeaker.flag}</span>
                  <span className="text-[12px] font-medium">{activeSpeaker.language}</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#64748B]">
                <Users className="h-12 w-12 text-[#94A3B8]" />
                <span className="text-[14px]">Waiting for participants...</span>
              </div>
            )}
          </div>

          {/* Small Tiles Strip */}
          <div className="flex-[1.5] min-w-[180px] max-w-[240px] flex flex-col gap-4">
            {/* Self Tile */}
            <div className="flex-1 min-h-[120px] relative bg-white rounded-xl overflow-hidden border border-[#3B82F6]/40 shadow-sm flex items-center justify-center">
              {!localIsVideoOff ? (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover transform -scale-x-100" 
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center text-lg font-bold">
                  {localUser?.initials || 'MU'}
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-2">
                <div className="bg-[#0F172A]/70 backdrop-blur-sm rounded px-2 py-0.5 text-white">
                  <span className="text-[11px] font-medium">You</span>
                </div>
                <div className="bg-[#F97316]/10 text-[#F97316] rounded text-[10px] px-1 font-bold">
                  HOST
                </div>
              </div>
              <div className="absolute top-2 right-2 bg-white/90 rounded-full px-1.5 py-0.5 flex items-center border border-[#E2E8F0] shadow-sm">
                <span className="text-[10px]">{srcLang.flag}</span>
              </div>
              {localIsMuted && (
                <div className="absolute bottom-2 right-2 h-6 w-6 rounded-full bg-[#DC2626] flex items-center justify-center shadow-lg">
                  <MicOff className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            {/* Remote Participant Tiles (up to 3) */}
            {remoteParticipants.slice(0, 3).map((p) => (
              <div key={p.id} className="flex-1 min-h-[120px] relative bg-white rounded-xl overflow-hidden border border-[#E2E8F0] shadow-sm flex items-center justify-center group">
                {p.isVideoOff ? (
                  <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-medium" style={{ backgroundColor: p.avatarColor }}>
                    {p.initials}
                  </div>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-medium" style={{ backgroundColor: p.avatarColor }}>
                      {p.initials}
                    </div>
                  </>
                )}
                {p.isMuted && (
                  <div className="absolute bottom-2 right-2 h-6 w-6 rounded-full bg-[#DC2626] flex items-center justify-center shadow-lg">
                    <MicOff className="h-3 w-3 text-white" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-[#0F172A]/70 backdrop-blur-sm rounded px-2 py-0.5 text-white">
                  <span className="text-[11px] font-medium truncate max-w-[100px] block">{p.name}</span>
                </div>
                <div className="absolute top-2 right-2 bg-white/90 rounded-full px-1.5 py-0.5 flex items-center border border-[#E2E8F0] shadow-sm">
                  <span className="text-[10px]">{p.flag}</span>
                </div>
              </div>
            ))}

            {/* Overflow indicator */}
            {remoteParticipants.length > 3 && (
              <div className="flex-1 min-h-[80px] relative bg-white rounded-xl overflow-hidden border border-[#E2E8F0] flex items-center justify-center shadow-sm">
                <span className="text-[#64748B] text-[14px] font-semibold">+{remoteParticipants.length - 3} more</span>
              </div>
            )}
          </div>
        </div>

        {/* Translation Status Badge */}
        <div className={`absolute top-[68px] ${isSidebarOpen ? 'right-[340px]' : 'right-6'} bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-md z-20 transition-all text-[#0F172A]`}>
          <div className="h-1.5 w-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
          <span className="text-[12px] font-medium">{srcLang.flag} {srcLang.name} → {tgtLang.flag} {tgtLang.name}</span>
        </div>

        {/* Bottom Control Bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 h-[56px] bg-white border border-[#E2E8F0] rounded-xl px-5 flex items-center gap-2 shadow-lg z-20">
          
          <button 
            onClick={toggleMic}
            className={`w-[52px] flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-[#F1F5F9] transition-colors py-1 focus:outline-none ${localIsMuted ? 'text-[#DC2626]' : 'text-[#64748B]'}`}
          >
            {localIsMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            <span className="text-[10px] font-medium">{localIsMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button 
            onClick={toggleVideo}
            className={`w-[52px] flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-[#F1F5F9] transition-colors py-1 focus:outline-none ${localIsVideoOff ? 'text-[#DC2626]' : 'text-[#64748B]'}`}
          >
            {localIsVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            <span className="text-[10px] font-medium">{localIsVideoOff ? 'Start Video' : 'Stop Video'}</span>
          </button>

          <button className="w-[52px] flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-[#F1F5F9] transition-colors py-1 text-[#64748B] focus:outline-none">
            <MonitorUp className="h-5 w-5" />
            <span className="text-[10px] font-medium">Share</span>
          </button>

          <button 
            onClick={() => toggleSidebar("chat")}
            className={`w-[52px] flex flex-col items-center justify-center gap-1 rounded-lg transition-colors py-1 relative focus:outline-none ${isSidebarOpen && activeTab === "chat" ? 'bg-[#EFF6FF] text-[#3B82F6]' : 'hover:bg-[#F1F5F9] text-[#64748B]'}`}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] font-medium">Chat</span>
            {unreadCount > 0 && (
              <div className="absolute top-0 right-1 h-4 min-w-[16px] bg-[#DC2626] rounded-full border-2 border-white text-[8px] text-white flex items-center justify-center font-bold px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </button>

          <button 
            onClick={() => toggleSidebar("participants")}
            className={`w-[52px] flex flex-col items-center justify-center gap-1 rounded-lg transition-colors py-1 relative focus:outline-none ${isSidebarOpen && activeTab === "participants" ? 'bg-[#EFF6FF] text-[#3B82F6]' : 'hover:bg-[#F1F5F9] text-[#64748B]'}`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[10px] font-medium">People</span>
            <div className="absolute top-0 right-1 bg-[#F1F5F9] rounded-full px-1 border-2 border-white text-[8px] flex items-center justify-center font-bold text-[#64748B]">
              {participants.length}
            </div>
          </button>

          <button className="w-[52px] flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-[#F1F5F9] transition-colors py-1 text-[#64748B] focus:outline-none">
            <Globe2 className="h-5 w-5" />
            <span className="text-[10px] font-medium">Lang</span>
          </button>

          <div className="w-[1px] h-8 bg-[#E2E8F0] mx-2" />

          <button 
            onClick={handleEndCall}
            className="w-[52px] flex flex-col items-center justify-center gap-1 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] transition-colors py-1 text-white ml-1 shadow-md shadow-red-500/10 focus:outline-none"
          >
            <PhoneOff className="h-5 w-5" />
            <span className="text-[10px] font-medium">End</span>
          </button>

        </div>
      </div>

      {/* Right Panel */}
      {isSidebarOpen && (
        <div className="w-[320px] bg-white border-l border-[#E2E8F0] flex flex-col shrink-0">
          
          {/* Tabs */}
          <div className="flex h-[52px] border-b border-[#E2E8F0]">
            <button 
              onClick={() => { setActiveTab("chat"); clearUnread() }}
              className={`flex-1 flex items-center justify-center text-[14px] font-semibold relative focus:outline-none ${activeTab === "chat" ? 'text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'}`}
            >
              Chat
              {activeTab === "chat" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />}
            </button>
            <button 
              onClick={() => setActiveTab("participants")}
              className={`flex-1 flex items-center justify-center text-[14px] font-semibold relative focus:outline-none ${activeTab === "participants" ? 'text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'}`}
            >
              Participants ({participants.length})
              {activeTab === "participants" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />}
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {activeTab === "chat" ? (
              <>
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#64748B]">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-50 text-[#94A3B8]" />
                    <p className="text-[13px] font-medium">No messages yet</p>
                    <p className="text-[11px] text-[#94A3B8]">Be the first to say something!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    msg.isOwn ? (
                      <div key={msg.id} className="flex gap-3 flex-row-reverse">
                        <div className="h-8 w-8 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center text-xs font-bold shrink-0 mt-1">{msg.senderInitials}</div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-[10px] text-[#94A3B8]">{msg.timestamp}</span>
                            <span className="text-[12px] font-semibold text-[#64748B]">You</span>
                          </div>
                          <div className="bg-[#3B82F6] text-white text-[14px] px-3 py-2 rounded-lg rounded-tr-sm inline-block shadow-sm max-w-[220px]">
                            {msg.message}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={msg.id} className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#F1F5F9] text-[#64748B] flex items-center justify-center text-xs font-bold shrink-0 mt-1">{msg.senderInitials}</div>
                        <div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-[12px] font-semibold text-[#0F172A]">{msg.senderName}</span>
                            <span className="text-[10px] text-[#94A3B8]">{msg.timestamp}</span>
                          </div>
                          <div className="bg-[#F1F5F9] text-[#0F172A] text-[14px] px-3 py-2 rounded-lg rounded-tl-sm inline-block max-w-[220px] shadow-sm">
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
                <h3 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">In this meeting ({participants.length})</h3>
                
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 hover:bg-[#F1F5F9] rounded-lg group h-10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs shrink-0 font-bold" style={{ backgroundColor: p.avatarColor }}>
                        {p.initials}
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[14px] font-semibold text-[#0F172A] truncate">{p.name}</span>
                        {p.id === 'local-user' && <span className="text-[12px] text-[#94A3B8] shrink-0">(You)</span>}
                        {p.isHost && <span className="text-[10px] text-[#F97316] bg-[#F97316]/10 px-1.5 py-0.5 rounded shrink-0 font-bold">HOST</span>}
                        {!p.isHost && <span className="text-[16px] shrink-0">{p.flag}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <div className="flex items-center gap-2 text-[#64748B]">
                        {p.isMuted ? <MicOff className="h-4 w-4 text-[#DC2626]" /> : <Mic className="h-4 w-4" />}
                        {p.isVideoOff ? <VideoOff className="h-4 w-4 text-[#DC2626]" /> : <Video className="h-4 w-4" />}
                      </div>
                      {/* Host Actions (only for remote participants) */}
                      {p.id !== 'local-user' && (
                        <div className="hidden group-hover:flex items-center gap-1 ml-1 pl-2 border-l border-[#E2E8F0]">
                          <button className="h-7 w-7 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors">
                            <MicOff className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => { setRemoveTarget(p.id); setShowRemoveModal(true) }}
                            className="h-7 w-7 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
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
            <div className="p-3 border-t border-[#E2E8F0]">
              <div className="relative">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message everyone..." 
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-3 pr-10 py-2.5 text-[14px] text-[#0F172A] focus:outline-none focus:border-[#3B82F6] placeholder:text-[#94A3B8]"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 bg-[#3B82F6] rounded-full flex items-center justify-center text-white hover:bg-[#2563EB] transition-colors disabled:opacity-40 disabled:hover:bg-[#3B82F6]"
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          
          {/* Invite Button */}
          {activeTab === "participants" && (
             <div className="p-3 border-t border-[#E2E8F0]">
                <button 
                  onClick={() => navigator.clipboard.writeText(`https://intellimeet.app/join/${id}`)}
                  className="w-full flex items-center justify-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#3B82F6] text-[13px] py-2.5 rounded-lg transition-colors font-medium"
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0D1117]/50 backdrop-blur-sm">
          <div className="bg-white rounded-[16px] w-full max-w-[480px] p-[32px] relative shadow-2xl mx-4">
            <button 
              onClick={() => { setShowRemoveModal(false); setRemoveTarget(null) }}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#0F172A] focus:outline-none"
            >
              <XCircle className="h-5 w-5" />
            </button>
            
            <div className="flex flex-col items-center text-center">
              <div className="h-10 w-10 bg-[#FEF3C7] rounded-[8px] flex items-center justify-center mb-4">
                <AlertTriangle className="h-5 w-5 text-[#D97706]" />
              </div>
              
              <h2 className="text-[20px] font-semibold text-[#0F172A] mb-2">
                Remove {participants.find(p => p.id === removeTarget)?.name || 'Participant'}?
              </h2>
              
              <p className="text-[14px] text-[#64748B] leading-[1.6] max-w-[360px] mb-6">
                {participants.find(p => p.id === removeTarget)?.name || 'This participant'} will be immediately disconnected from this meeting. They won't be able to rejoin unless you invite them again.
              </p>
              
              <div className="w-full flex items-center gap-2 mb-6">
                <input type="checkbox" id="prevent-rejoin" className="rounded border-[#E2E8F0] text-[#3B82F6]" />
                <label htmlFor="prevent-rejoin" className="text-[14px] text-[#64748B] cursor-pointer">Also prevent this participant from rejoining</label>
              </div>
              
              <div className="w-full flex items-center justify-end gap-3">
                <button 
                  onClick={() => { setShowRemoveModal(false); setRemoveTarget(null) }}
                  className="h-10 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[#0F172A] text-[14px] font-medium hover:bg-gray-50 transition-colors focus:outline-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRemoveParticipant}
                  className="h-10 px-4 rounded-[8px] bg-[#DC2626] text-white text-[14px] font-medium hover:bg-[#B91C1C] transition-colors focus:outline-none"
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
