import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Mic, MicOff, Video, VideoOff, Settings, Loader2, AlertTriangle, ArrowLeft, Volume2 } from "lucide-react"
import { useMeetingStore } from "@/store/useMeetingStore"
import { useAuthStore } from "@/store/useAuthStore"
import { meetingApi, describeApiError, toApiError, type MeetingDto } from "@/lib/api"
import { normalizeMeetingId } from "@/lib/meetingId"
import { saveJoinPrefs } from "@/lib/joinPrefs"
import { useMediaDevices } from "@/hooks/useMediaDevices"
import { useAudioLevel } from "@/hooks/useAudioLevel"

type LookupState =
  | { kind: "loading" }
  | { kind: "ready"; meeting: MeetingDto }
  | { kind: "error"; code: string | null; message: string }

/** Map getUserMedia failures to something a person can act on */
function describeMediaError(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : ""
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "IntelliMeet needs camera and microphone access. Allow it in your browser's site settings, then retry."
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera or microphone was found. You can still join to listen."
    case "NotReadableError":
    case "AbortError":
      return "Your camera or microphone is being used by another app."
    default:
      return "Couldn't access your camera or microphone."
  }
}

export function LobbyPage() {
  const { meetingId: rawMeetingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const joinMeeting = useMeetingStore((s) => s.joinMeeting)

  const meetingId = normalizeMeetingId(rawMeetingId)

  const [lookup, setLookup] = useState<LookupState>({ kind: "loading" })
  const [micOn, setMicOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [sourceLang, setSourceLang] = useState(user?.preferences?.sourceLanguage || "en")
  const [targetLang, setTargetLang] = useState(user?.preferences?.targetLanguage || "zh")
  const [isJoining, setIsJoining] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const displayName = user?.name || "You"

  // Device pickers. Labels only appear once the browser has granted access,
  // so the list fills in after the first successful getUserMedia.
  const media = useMediaDevices(lookup.kind === "ready")
  const { selected, select, cameras, microphones, hasLabels, refresh } = media

  // Real microphone meter, so you can confirm the right mic is picked up.
  const audioLevel = useAudioLevel(stream, micOn)

  // ── 1. Validate the meeting against the server before anything else ──
  useEffect(() => {
    let cancelled = false
    if (!meetingId) {
      setLookup({
        kind: "error",
        code: "INVALID_MEETING_ID",
        message: "That doesn't look like a meeting code. Codes look like abc-defg-hij.",
      })
      return
    }
    setLookup({ kind: "loading" })
    meetingApi
      .get(meetingId)
      .then(({ meeting }) => {
        if (cancelled) return
        if (meeting.status === "ENDED") {
          setLookup({ kind: "error", code: "MEETING_ENDED", message: "This meeting has ended." })
        } else {
          setLookup({ kind: "ready", meeting })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setLookup({ kind: "error", code: toApiError(err).code, message: describeApiError(err) })
      })
    return () => {
      cancelled = true
    }
  }, [meetingId])

  // ── 2. Camera / mic preview (only once the meeting is valid) ─────────
  useEffect(() => {
    if (lookup.kind !== "ready") return
    let activeStream: MediaStream | null = null

    // Ask for the remembered devices when we have them, otherwise let the
    // browser choose. `ideal` rather than `exact` so an unplugged device
    // degrades to the default instead of throwing OverconstrainedError.
    const videoWanted = selected.videoinput ? { deviceId: { ideal: selected.videoinput } } : true
    const audioWanted = selected.audioinput ? { deviceId: { ideal: selected.audioinput } } : true

    const initMedia = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError("Your browser doesn't support video calls. Use Chrome, Edge, Firefox or Safari.")
        return
      }
      setMediaError(null)
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: videoWanted, audio: audioWanted })
      } catch (err) {
        setMediaError(describeMediaError(err))
        // Fall back to whichever single device we can get, so someone with a
        // microphone but no webcam can still join and be heard.
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({ audio: audioWanted })
        } catch {
          try {
            activeStream = await navigator.mediaDevices.getUserMedia({ video: videoWanted })
          } catch {
            activeStream = null
          }
        }
      }
      if (cancelled) {
        activeStream?.getTracks().forEach((t) => t.stop())
        return
      }
      if (activeStream) {
        setStream(activeStream)
        if (videoRef.current) videoRef.current.srcObject = activeStream
        // Labels are only exposed after permission, so enumerate again now.
        refresh()
      }
    }

    let cancelled = false
    initMedia()
    return () => {
      cancelled = true
      activeStream?.getTracks().forEach((t) => t.stop())
    }
    // Re-acquiring on a device change is exactly what makes the pickers work.
  }, [lookup.kind, selected.videoinput, selected.audioinput, refresh])

  // Bind the preview element whenever the stream or the toggle changes
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
  }, [stream, videoOn])

  // Toggle tracks when state changes
  useEffect(() => {
    if (!stream) return
    stream.getVideoTracks().forEach((t) => { t.enabled = videoOn })
    stream.getAudioTracks().forEach((t) => { t.enabled = micOn })
  }, [micOn, videoOn, stream])

  const handleJoin = () => {
    if (lookup.kind !== "ready" || !meetingId || !user) return
    setIsJoining(true)

    // Persist the toggles so a refresh inside the room keeps them. Without
    // this the room would fall back to its privacy-safe default of both off.
    saveJoinPrefs(meetingId, { micOn, cameraOn: videoOn })

    joinMeeting({
      meetingId,
      title: lookup.meeting.title,
      userId: user.id,
      userName: displayName,
      sourceLang,
      targetLang,
      micOn,
      videoOn,
    })

    navigate(`/meet/${meetingId}/room`)
  }

  // ── Error / loading screens ───────────────────────────────────────────
  if (lookup.kind !== "ready") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 font-body text-[#0F172A]">
        <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-lg text-center">
          {lookup.kind === "loading" ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-[#3B82F6] mx-auto mb-4" />
              <p className="text-[#64748B] text-sm">Checking meeting…</p>
              {meetingId && <p className="font-mono text-[#3B82F6] mt-2 break-all">{meetingId}</p>}
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold font-display mb-2 break-words">
                {lookup.code === "MEETING_NOT_FOUND" ? "Meeting not found" :
                 lookup.code === "MEETING_ENDED" ? "This meeting has ended" :
                 lookup.code === "PARTICIPANT_BANNED" ? "You can't join this meeting" :
                 lookup.code === "MEETING_LOCKED" ? "Meeting is locked" :
                 "Can't open this meeting"}
              </h1>
              <p className="text-[#64748B] text-sm mb-6 break-words">{lookup.message}</p>
              {meetingId && <p className="font-mono text-xs text-[#94A3B8] mb-6 break-all">{meetingId}</p>}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="ghost" onClick={() => navigate("/join")} className="h-11 sm:h-10 text-[#0F172A]">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Try another code
                </Button>
                <Button onClick={() => navigate("/dashboard")} className="h-11 sm:h-10 bg-[#3B82F6] text-white hover:bg-[#2563EB]">
                  Back to dashboard
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  const meeting = lookup.meeting
  const hasVideo = !!(stream && stream.getVideoTracks().length > 0)

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 md:p-8 font-body text-[#0F172A] relative">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-center relative z-10">

        {/* Left/Main: Camera Preview */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          <div className="relative aspect-video bg-[#0F172A] rounded-2xl border border-[#E2E8F0] shadow-md overflow-hidden flex flex-col items-center justify-center group">
            {videoOn && hasVideo ? (
              <div className="w-full h-full bg-[#0F172A] flex items-center justify-center relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                <div className="absolute bottom-4 left-4 z-20">
                  <span className="bg-black/60 border border-white/10 px-3.5 py-1.5 rounded-xl text-[13px] font-medium backdrop-blur-md text-white/90">
                    {displayName}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center z-10 px-4 pb-14 text-center sm:pb-0">
                <div className="h-16 w-16 sm:h-24 sm:w-24 rounded-full bg-[#EFF6FF] text-[#3B82F6] border border-[#BFDBFE] flex items-center justify-center text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 shadow-sm">
                  {displayName.substring(0, 2).toUpperCase()}
                </div>
                <p className="text-white/60 font-medium text-sm">
                  {!hasVideo && videoOn ? "Camera unavailable" : "Camera is turned off"}
                </p>
              </div>
            )}

            {/* Live microphone meter — reads the real signal, so it only moves
                when you speak. Confirms the selected mic is the one picking up. */}
            {micOn && stream && stream.getAudioTracks().length > 0 && (
              <div
                className="absolute top-4 right-4 z-20 flex h-5 items-end gap-1 rounded-lg border border-white/5 bg-black/40 px-2 py-1.5 backdrop-blur-md"
                aria-label="Microphone level"
              >
                {[0, 1, 2, 3, 4].map((i) => {
                  const lit = audioLevel * 5 > i
                  return (
                    <div
                      key={i}
                      className="w-1.5 rounded-t transition-[height,background-color] duration-100"
                      style={{
                        height: lit ? `${40 + i * 15}%` : "25%",
                        backgroundColor: lit ? "#10B981" : "rgba(255,255,255,0.25)",
                      }}
                    />
                  )
                })}
              </div>
            )}

            {/* Video Overlay Controls */}
            <div className="absolute bottom-4 right-4 flex gap-3 z-20">
              <button
                onClick={() => setMicOn(!micOn)}
                disabled={isJoining}
                aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
                aria-pressed={!micOn}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white backdrop-blur-md border ${
                  micOn ? "bg-white/80 border-white/20 text-[#0F172A] hover:bg-white" : "bg-red-500/90 border-red-500/50 text-white hover:bg-red-600"
                } disabled:opacity-50`}
              >
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button
                onClick={() => setVideoOn(!videoOn)}
                disabled={isJoining}
                aria-label={videoOn ? "Turn camera off" : "Turn camera on"}
                aria-pressed={!videoOn}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white backdrop-blur-md border ${
                  videoOn ? "bg-white/80 border-white/20 text-[#0F172A] hover:bg-white" : "bg-red-500/90 border-red-500/50 text-white hover:bg-red-600"
                } disabled:opacity-50`}
              >
                {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {mediaError && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{mediaError} You can still join.</span>
            </div>
          )}
        </div>

        {/* Right/Sidebar: Meeting info + settings */}
        <div className="lg:col-span-5 min-w-0 bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-lg flex flex-col justify-between sm:min-h-[400px]">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-display text-[#0F172A] tracking-tight">Ready to join?</h2>
              <p className="text-[15px] text-[#0F172A] mt-2 font-semibold break-words">{meeting.title}</p>
              <p className="text-[13px] text-[#64748B] mt-1 font-medium break-words">
                {meeting.isHost ? "You are the host" : `Hosted by ${meeting.host.name || "the organiser"}`} · <span className="font-mono text-[#3B82F6]">{meetingId}</span>
              </p>
              {meeting.status === "CREATED" && !meeting.isHost && (
                <p className="text-[12px] text-[#94A3B8] mt-1">The host hasn't started yet. You can join and wait.</p>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Joining as</label>
                <div className="h-11 px-3 flex items-center overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] text-[14px]">
                  {displayName} <span className="ml-2 min-w-0 truncate text-[#94A3B8] text-[12px]">({user?.email})</span>
                </div>
              </div>

              {/* Device pickers. Labels stay blank until the browser grants
                  access, so this only appears once we have real names. */}
              {hasLabels && (cameras.length > 1 || microphones.length > 1) && (
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                  <h4 className="font-semibold text-[#0F172A] flex items-center text-sm">
                    <Volume2 className="mr-2 h-4 w-4 text-[#3B82F6]" />
                    Devices
                  </h4>

                  {cameras.length > 1 && (
                    <div>
                      <label htmlFor="camera-select" className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                        Camera
                      </label>
                      <select
                        id="camera-select"
                        value={media.activeCameraId ?? ""}
                        onChange={(e) => select("videoinput", e.target.value)}
                        disabled={isJoining}
                        className="w-full h-11 sm:h-10 rounded-xl border border-[#E2E8F0] bg-white px-3 text-[16px] sm:text-[13px] text-[#0F172A] focus:border-[#3B82F6] focus:outline-none"
                      >
                        {cameras.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || "Camera"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {microphones.length > 1 && (
                    <div>
                      <label htmlFor="mic-select" className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                        Microphone
                      </label>
                      <select
                        id="mic-select"
                        value={media.activeMicrophoneId ?? ""}
                        onChange={(e) => select("audioinput", e.target.value)}
                        disabled={isJoining}
                        className="w-full h-11 sm:h-10 rounded-xl border border-[#E2E8F0] bg-white px-3 text-[16px] sm:text-[13px] text-[#0F172A] focus:border-[#3B82F6] focus:outline-none"
                      >
                        {microphones.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || "Microphone"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <p className="text-[10px] text-[#64748B] font-medium">Your choice is remembered for next time.</p>
                </div>
              )}

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
                <h4 className="font-semibold text-[#0F172A] flex items-center text-sm">
                  <Settings className="mr-2 h-4 w-4 text-[#3B82F6]" />
                  Translation Preferences
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">I speak</label>
                    <Select value={sourceLang} onValueChange={setSourceLang} disabled={isJoining}>
                      <SelectTrigger className="h-11 sm:h-10 bg-white border-[#E2E8F0] text-[#0F172A] rounded-xl"><SelectValue /></SelectTrigger>
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
                      <SelectTrigger className="h-11 sm:h-10 bg-white border-[#E2E8F0] text-[#0F172A] rounded-xl"><SelectValue /></SelectTrigger>
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

          <div className="flex gap-3 mt-6">
            <Button variant="ghost" onClick={() => navigate("/dashboard")} disabled={isJoining} className="h-11 sm:h-10 shrink-0 text-[#64748B] hover:text-[#0F172A]">
              Back
            </Button>
            <Button
              size="lg"
              className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-xl h-11 shadow-md shadow-blue-500/10 active:scale-[0.98] transition-all"
              onClick={handleJoin}
              disabled={isJoining || !user}
            >
              {isJoining ? (
                <span className="flex items-center gap-2 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  Joining…
                </span>
              ) : (
                "Join now"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
