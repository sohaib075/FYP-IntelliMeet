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
  const [displayName, setDisplayName] = useState(user?.name || "John Doe")
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
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-body">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Main: Camera Preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video bg-white rounded-2xl border border-[#E2E8F0] shadow-md overflow-hidden flex flex-col items-center justify-center">
            {videoOn ? (
              <div className="w-full h-full bg-gray-900 flex items-center justify-center relative">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover transform -scale-x-100" 
                />
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                  <span className="text-white bg-black/50 px-3 py-1.5 rounded-lg text-[13px] font-medium backdrop-blur-sm">{displayName}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-24 w-24 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center text-3xl font-semibold mb-4">
                  {displayName.substring(0, 2).toUpperCase()}
                </div>
                <p className="text-[#64748B] font-medium">Camera is off</p>
              </div>
            )}
            
            {/* Audio level visualizer mock */}
            {micOn && (
              <div className="absolute top-4 right-4 flex gap-1 h-4 items-end">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-1.5 bg-green-500 rounded-t animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setMicOn(!micOn)}
              disabled={isJoining}
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-all shadow-md focus:outline-none ${
                micOn ? "bg-[#EFF6FF] text-[#3B82F6] hover:bg-[#E0F2FE]" : "bg-red-500 text-white hover:bg-red-600"
              } disabled:opacity-50`}
            >
              {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </button>
            <button
              onClick={() => setVideoOn(!videoOn)}
              disabled={isJoining}
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-all shadow-md focus:outline-none ${
                videoOn ? "bg-[#EFF6FF] text-[#3B82F6] hover:bg-[#E0F2FE]" : "bg-red-500 text-white hover:bg-red-600"
              } disabled:opacity-50`}
            >
              {videoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Right/Sidebar: Settings */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-lg flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#0F172A] font-display">Ready to join?</h2>
            <p className="text-[13px] text-[#64748B] mt-1">IntelliMeet Session • {meetingId}</p>
          </div>

          <div className="space-y-6 flex-1">
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isJoining}
            />

            <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
              <h4 className="font-semibold text-[#0F172A] flex items-center text-sm">
                <Settings className="mr-2 h-4 w-4 text-[#3B82F6]" />
                Translation Preferences
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">I speak</label>
                  <Select value={sourceLang} onValueChange={setSourceLang} disabled={isJoining}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="ur">🇵🇰 Urdu</SelectItem>
                      <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">I want to hear</label>
                  <Select value={targetLang} onValueChange={setTargetLang} disabled={isJoining}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="ur">🇵🇰 Urdu</SelectItem>
                      <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[10px] text-[#64748B]">These are your personal translation preferences for this session.</p>
            </div>
          </div>

          <Button 
            size="lg" 
            className="w-full mt-8 bg-[#3B82F6] hover:bg-[#2563EB] text-white" 
            onClick={handleJoin}
            disabled={isJoining || !displayName.trim()}
          >
            {isJoining ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
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
