import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Mic, MicOff, Video, VideoOff, Settings, Loader2 } from "lucide-react"
import { useMeetingStore } from "@/store/useMeetingStore"
import { useAuthStore } from "@/store/useAuthStore"

export function LobbyPage() {
  const { meetingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { joinMeeting, status } = useMeetingStore()
  
  const [micOn, setMicOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [displayName, setDisplayName] = useState(user?.name || "")
  const [sourceLang, setSourceLang] = useState(user?.preferences?.sourceLanguage || "en")
  const [targetLang, setTargetLang] = useState(user?.preferences?.targetLanguage || "zh")
  const [isJoining, setIsJoining] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    // Request hardware access on mount
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
        console.error("Failed to get media devices", err)
      })

    return () => {
      // Cleanup tracks on unmount
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Toggle tracks when state changes
  useEffect(() => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = videoOn
      })
      stream.getAudioTracks().forEach(track => {
        track.enabled = micOn
      })
    }
  }, [micOn, videoOn, stream])

  const handleJoin = () => {
    setIsJoining(true)

    // Initialize the meeting store
    joinMeeting({
      meetingId: meetingId || 'unknown',
      title: 'CPEC Quarterly Review',
      userName: displayName,
      sourceLang,
      targetLang,
      micOn,
      videoOn,
    })

    // Simulate a brief "connecting" phase
    setTimeout(() => {
      navigate(`/meeting/room/${meetingId}`)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 md:p-8 font-body text-[#0F172A] relative">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Left/Main: Camera Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-video bg-[#0F172A] rounded-2xl border border-[#E2E8F0] shadow-md overflow-hidden flex flex-col items-center justify-center group">
            {videoOn ? (
              <div className="w-full h-full bg-[#0F172A] flex items-center justify-center relative">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover transform -scale-x-100" 
                />
                <div className="absolute bottom-4 left-4 z-20">
                  <span className="bg-black/60 border border-white/10 px-3.5 py-1.5 rounded-xl text-[13px] font-medium backdrop-blur-md text-white/90">
                    {displayName || user?.name || "You"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center z-10">
                <div className="h-24 w-24 rounded-full bg-[#EFF6FF] text-[#3B82F6] border border-[#BFDBFE] flex items-center justify-center text-3xl font-bold mb-4 shadow-sm">
                  {(displayName || "U").substring(0, 2).toUpperCase()}
                </div>
                <p className="text-white/60 font-medium text-sm">Camera is turned off</p>
              </div>
            )}
            
            {/* Audio level visualizer mock */}
            {micOn && (
              <div className="absolute top-4 right-4 flex gap-1 h-5 items-end z-20 bg-black/40 px-2 py-1.5 rounded-lg border border-white/5 backdrop-blur-md">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-1.5 bg-[#10B981] rounded-t animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}

            {/* Video Overlay Controls */}
            <div className="absolute bottom-4 right-4 flex gap-3 z-20">
              <button
                onClick={() => setMicOn(!micOn)}
                disabled={isJoining}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all shadow-md focus:outline-none backdrop-blur-md border ${
                  micOn 
                    ? "bg-white/80 border-white/20 text-[#0F172A] hover:bg-white" 
                    : "bg-red-500/90 border-red-500/50 text-white hover:bg-red-600"
                } disabled:opacity-50`}
                title={micOn ? "Mute Microphone" : "Unmute Microphone"}
              >
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button
                onClick={() => setVideoOn(!videoOn)}
                disabled={isJoining}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all shadow-md focus:outline-none backdrop-blur-md border ${
                  videoOn 
                    ? "bg-white/80 border-white/20 text-[#0F172A] hover:bg-white" 
                    : "bg-red-500/90 border-red-500/50 text-white hover:bg-red-600"
                } disabled:opacity-50`}
                title={videoOn ? "Turn Camera Off" : "Turn Camera On"}
              >
                {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right/Sidebar: Settings */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-6.5 shadow-lg flex flex-col justify-between min-h-[400px]">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-display text-[#0F172A] tracking-tight">Ready to join?</h2>
              <p className="text-[13px] text-[#64748B] mt-1 font-medium">IntelliMeet Session • <span className="font-mono text-[#3B82F6]">{meetingId}</span></p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Display Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isJoining}
                  className="bg-white border-[#E2E8F0] text-[#0F172A] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/10 rounded-xl h-11"
                />
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
                <h4 className="font-semibold text-[#0F172A] flex items-center text-sm">
                  <Settings className="mr-2 h-4.5 w-4.5 text-[#3B82F6]" />
                  Translation Preferences
                </h4>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">I speak</label>
                    <Select value={sourceLang} onValueChange={setSourceLang} disabled={isJoining}>
                      <SelectTrigger className="bg-white border-[#E2E8F0] text-[#0F172A] rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white border-[#E2E8F0] text-[#0F172A]">
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                        <SelectItem value="ur">🇵🇰 Urdu</SelectItem>
                        <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">I want to hear</label>
                    <Select value={targetLang} onValueChange={setTargetLang} disabled={isJoining}>
                      <SelectTrigger className="bg-white border-[#E2E8F0] text-[#0F172A] rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white border-[#E2E8F0] text-[#0F172A]">
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                        <SelectItem value="ur">🇵🇰 Urdu</SelectItem>
                        <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[10px] text-[#64748B] font-medium leading-normal">These are your personal translation preferences for this session.</p>
              </div>
            </div>
          </div>

          <Button 
            size="lg" 
            className="w-full mt-6 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-xl h-11.5 shadow-md shadow-blue-500/10 active:scale-[0.98] transition-all" 
            onClick={handleJoin}
            disabled={isJoining || !displayName.trim()}
          >
            {isJoining ? (
              <span className="flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                Connecting...
              </span>
            ) : (
              'Join Now'
            )}
          </Button>
        </div>
        
      </div>
    </div>
  )
}
