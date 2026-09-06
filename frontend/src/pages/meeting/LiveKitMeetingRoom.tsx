import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  RoomContext,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  isTrackReference,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react"
import { Track, RoomEvent, type RemoteParticipant } from "livekit-client"
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare, Users, PhoneOff,
  Copy, XCircle, AlertTriangle, Send, Crown, Volume2, Loader2, MoreVertical, UserX,
  WifiOff, Settings,
} from "lucide-react"
import { Logo } from "@/components/common/Logo"
import { ParticipantTile } from "@/components/meeting/ParticipantTile"
import { useLiveKitMeeting } from "@/hooks/useLiveKitMeeting"
import { useMediaDevices } from "@/hooks/useMediaDevices"
import { meetingApi, describeApiError, type MeetingDto } from "@/lib/api"
import { meetingLink } from "@/lib/meetingId"
import { roleOf, initialsOf, avatarColorOf } from "@/lib/livekit"
import { loadJoinPrefs } from "@/lib/joinPrefs"
import { useMeetingStore } from "@/store/useMeetingStore"
import { useToastStore } from "@/store/useToastStore"

// ─── Helpers ────────────────────────────────────────────────────────

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

interface ChatMsg {
  id: string
  senderId: string
  senderName: string
  text: string
  at: number
  isOwn: boolean
}

/** Longest single chat message we will send or display. */
const MAX_MESSAGE_LENGTH = 2000
/** Most recent messages kept in memory for one call. */
const MAX_MESSAGES = 300

/** Grid columns that keep tiles close to 16:9 for a given participant count. */
function gridClassFor(count: number): string {
  if (count <= 1) return "grid-cols-1"
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2"
  if (count <= 9) return "grid-cols-2 lg:grid-cols-3"
  return "grid-cols-2 lg:grid-cols-4"
}

// ─── Outer component: owns the connection ───────────────────────────

interface Props {
  meetingId: string
  /** Rendered when the backend has no LiveKit configured */
  fallback: React.ReactNode
}

export function LiveKitMeetingRoom({ meetingId, fallback }: Props) {
  const navigate = useNavigate()
  const leaveMeeting = useMeetingStore((s) => s.leaveMeeting)

  // Read the lobby's toggles from sessionStorage rather than the in-memory
  // store, which is empty after a refresh or a direct link. Missing prefs mean
  // mic and camera stay off until the user asks for them.
  const [joinPrefs] = useState(() => loadJoinPrefs(meetingId))

  const { room, phase, meeting, role, identity, mediaError, needsAudioUnlock, unlockAudio, retry } =
    useLiveKitMeeting(meetingId, { micOn: joinPrefs.micOn, cameraOn: joinPrefs.cameraOn })

  // When the session ends, clean the store and explain why on the ended page.
  //
  // 'lost' is the exception: the connection dropped for a reason nobody chose,
  // so the meeting may well still be running. Ejecting someone to a "meeting
  // ended" page after a Wi-Fi blip would be wrong and, mid-demo, alarming.
  // That case falls through to the Reconnect screen below instead.
  useEffect(() => {
    if (phase.kind !== "ended" || phase.reason === "lost") return
    leaveMeeting()
    navigate(`/meeting/ended?reason=${phase.reason}`, { replace: true })
  }, [phase, leaveMeeting, navigate])

  if (phase.kind === "ended" && phase.reason === "lost") {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-6 font-body">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#78350F] text-amber-200">
            <WifiOff className="h-6 w-6" />
          </div>
          <h1 className="mb-2 font-display text-xl font-bold text-white">Connection lost</h1>
          <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
            You were disconnected from the meeting. It may still be running.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => {
                leaveMeeting()
                navigate("/dashboard", { replace: true })
              }}
              className="h-10 rounded-lg border border-[var(--color-border-default)] px-4 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-light)]"
            >
              Leave the meeting
            </button>
            <button
              onClick={retry}
              className="h-10 rounded-lg bg-[var(--color-brand-blue)] px-5 text-sm font-semibold text-white hover:bg-[#2563EB]"
            >
              Rejoin
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase.kind === "unavailable") return <>{fallback}</>

  if (phase.kind === "error") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-body text-[#0F172A]">
        <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl p-8 shadow-lg text-center">
          <div className="h-12 w-12 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold font-display mb-2">Can't join this meeting</h1>
          <p className="text-[#64748B] text-sm mb-6">{phase.message}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={retry}
              className="h-10 px-4 rounded-lg border border-[#E2E8F0] text-[#0F172A] text-sm font-medium hover:bg-[#F8FAFC]"
            >
              Try again
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="h-10 px-4 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB]"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase.kind === "loading" || phase.kind === "connecting" || phase.kind === "ended") {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-blue)]" />
        <p className="text-[var(--color-text-secondary)] text-sm">
          {phase.kind === "loading" ? "Checking your access…" : "Connecting to the meeting…"}
        </p>
      </div>
    )
  }

  return (
    <RoomContext.Provider value={room}>
      {/* Plays every remote audio track. Without this you see video but hear nothing. */}
      <RoomAudioRenderer />
      <MeetingStage
        meetingId={meetingId}
        meeting={meeting}
        role={role}
        identity={identity}
        isReconnecting={phase.kind === "reconnecting"}
        mediaError={mediaError}
        needsAudioUnlock={needsAudioUnlock}
        onUnlockAudio={unlockAudio}
      />
    </RoomContext.Provider>
  )
}

// ─── Inner component: everything that needs the room context ────────

interface StageProps {
  meetingId: string
  meeting: MeetingDto | null
  role: "HOST" | "PARTICIPANT"
  identity: string
  isReconnecting: boolean
  mediaError: string | null
  needsAudioUnlock: boolean
  onUnlockAudio: () => void
}

function MeetingStage({
  meetingId, meeting, role, identity, isReconnecting, mediaError, needsAudioUnlock, onUnlockAudio,
}: StageProps) {
  const navigate = useNavigate()
  const room = useRoomContext()
  const addToast = useToastStore((s) => s.addToast)
  const leaveMeeting = useMeetingStore((s) => s.leaveMeeting)

  const participants = useParticipants()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant()

  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  })
  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], {
    onlySubscribed: false,
  })

  const isHost = role === "HOST"
  const activeShare = screenTracks.find(isTrackReference)

  // ── UI state ──
  const [sidebar, setSidebar] = useState<"chat" | "participants" | null>("chat")
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [unread, setUnread] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<RemoteParticipant | null>(null)
  const [banOnRemove, setBanOnRemove] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Device pickers for switching camera or microphone without leaving the call.
  const devices = useMediaDevices(true)

  const switchDevice = async (kind: "videoinput" | "audioinput", deviceId: string) => {
    devices.select(kind, deviceId)
    try {
      await room.switchActiveDevice(kind === "videoinput" ? "videoinput" : "audioinput", deviceId)
    } catch {
      addToast({ message: "Could not switch to that device.", variant: "error" })
    }
  }

  // ── Meeting timer, anchored to the server's start time ──
  useEffect(() => {
    const startedAt = meeting?.startedAt ? new Date(meeting.startedAt).getTime() : Date.now()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [meeting?.startedAt])

  // ── Chat over LiveKit data messages ──
  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic && topic !== "chat") return
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload)) as { text?: string }
        // Cap the length: this arrives from another participant, so it is
        // untrusted input and must not be allowed to blow up the panel.
        const text = typeof parsed.text === "string" ? parsed.text.trim().slice(0, MAX_MESSAGE_LENGTH) : ""
        if (!text) return
        const incoming: ChatMsg = {
          id: `${Date.now()}-${Math.random()}`,
          senderId: participant?.identity ?? "unknown",
          // Sender name comes from LiveKit, not the payload, so it cannot be spoofed.
          senderName: participant?.name || participant?.identity || "Someone",
          text,
          at: Date.now(),
          isOwn: false,
        }
        // Keep only the most recent messages so a long or spammy call cannot
        // grow this array without bound.
        setMessages((prev) => [...prev, incoming].slice(-MAX_MESSAGES))
        setUnread((n) => (sidebar === "chat" ? 0 : n + 1))
      } catch {
        /* ignore malformed payloads */
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room, sidebar])

  // Keep the newest message in view, including the first time the panel opens
  // (otherwise it renders scrolled to the oldest message).
  useEffect(() => {
    if (sidebar !== "chat") return
    chatEndRef.current?.scrollIntoView({ block: "end" })
  }, [messages, sidebar])

  // Dismiss the host menu on Escape or a click anywhere outside it.
  useEffect(() => {
    if (!menuFor) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuFor(null)
    const onClick = () => setMenuFor(null)
    window.addEventListener("keydown", onKey)
    // Deferred so the click that opened the menu does not immediately close it.
    const id = setTimeout(() => window.addEventListener("click", onClick), 0)
    return () => {
      clearTimeout(id)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("click", onClick)
    }
  }, [menuFor])

  useEffect(() => {
    if (sidebar === "chat") setUnread(0)
  }, [sidebar])

  const sendChat = useCallback(async () => {
    const text = chatInput.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!text) return
    setChatInput("")
    const id = `${Date.now()}-own`
    setMessages((prev) =>
      [...prev, { id, senderId: identity, senderName: "You", text, at: Date.now(), isOwn: true }].slice(-MAX_MESSAGES)
    )
    try {
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ text })), {
        reliable: true,
        topic: "chat",
      })
    } catch {
      // Do not leave a message sitting there looking delivered when it was not.
      setMessages((prev) => prev.filter((m) => m.id !== id))
      setChatInput(text)
      addToast({ message: "Message could not be sent. Try again.", variant: "error" })
    }
  }, [chatInput, identity, room, addToast])

  // ── Controls ──
  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch {
      addToast({ message: "Could not access your microphone.", variant: "error" })
    }
  }

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled)
    } catch {
      addToast({ message: "Could not access your camera.", variant: "error" })
    }
  }

  const toggleShare = async () => {
    if (!isScreenShareEnabled && activeShare) {
      addToast({ message: "Someone is already presenting.", variant: "error" })
      return
    }
    try {
      // The SDK opens the browser picker and unpublishes automatically when
      // the user stops sharing from the browser's own bar.
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled, { audio: true })
    } catch {
      /* the user cancelled the picker — nothing to report */
    }
  }

  const leave = () => {
    room.disconnect()
    leaveMeeting()
    navigate("/meeting/ended?reason=left", { replace: true })
  }

  const endForEveryone = async () => {
    setBusy(true)
    try {
      await meetingApi.end(meetingId)
      // The server deletes the room; our own Disconnected event navigates.
      room.disconnect()
      leaveMeeting()
      navigate("/meeting/ended?reason=ended", { replace: true })
    } catch (err) {
      addToast({ message: describeApiError(err), variant: "error" })
      setBusy(false)
      setShowLeaveModal(false)
    }
  }

  const muteParticipant = async (p: RemoteParticipant, source: "microphone" | "camera") => {
    setMenuFor(null)
    try {
      await meetingApi.muteParticipant(meetingId, p.identity, source)
      addToast({
        message: `${p.name || "Participant"}'s ${source === "camera" ? "camera" : "microphone"} was turned off.`,
        variant: "success",
      })
    } catch (err) {
      addToast({ message: describeApiError(err), variant: "error" })
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setBusy(true)
    try {
      await meetingApi.removeParticipant(meetingId, removeTarget.identity, banOnRemove)
      addToast({ message: `${removeTarget.name || "Participant"} was removed.`, variant: "success" })
    } catch (err) {
      addToast({ message: describeApiError(err), variant: "error" })
    } finally {
      setBusy(false)
      setRemoveTarget(null)
      setBanOnRemove(false)
    }
  }

  const copyInvite = () => {
    navigator.clipboard
      .writeText(meetingLink(meetingId))
      .then(() => addToast({ message: "Invite link copied", variant: "success" }))
      .catch(() => addToast({ message: "Couldn't copy the link", variant: "error" }))
  }

  // Camera tiles: the local participant first, then everyone else.
  const orderedTiles = useMemo(() => {
    const local: TrackReferenceOrPlaceholder[] = []
    const remote: TrackReferenceOrPlaceholder[] = []
    for (const t of cameraTracks) (t.participant.isLocal ? local : remote).push(t)
    return [...local, ...remote]
  }, [cameraTracks])

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg-primary)] font-body">
      {/* ── Top bar ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border-default)] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Logo size={24} className="shrink-0 text-white" />
          <div className="hidden h-4 w-px bg-[var(--color-border-default)] sm:block" />
          <span className="truncate text-[14px] font-semibold text-[var(--color-text-primary)]">
            {meeting?.title || "Meeting"}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="font-mono text-[12px] text-[var(--color-text-secondary)]">{meetingId}</span>
            <button
              onClick={copyInvite}
              aria-label="Copy invite link"
              className="text-[var(--color-text-secondary)] transition-colors hover:text-white"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>

        <span className="rounded bg-[var(--color-bg-primary)]/40 px-2 py-0.5 font-mono text-[14px] font-semibold tabular-nums tracking-wider text-[var(--color-text-primary)]">
          {formatElapsed(elapsed)}
        </span>

        <div className="flex items-center gap-3">
          {isHost && (
            <span className="flex items-center gap-1 rounded-full bg-[#F59E0B]/10 px-2 py-0.5 text-[11px] font-semibold text-[#F59E0B]">
              <Crown className="h-3 w-3" /> Host
            </span>
          )}
          <span className="text-[13px] text-[var(--color-text-secondary)]">
            {participants.length} {participants.length === 1 ? "person" : "people"}
          </span>
        </div>
      </header>

      {/* ── Banners ── */}
      {isReconnecting && (
        <div role="status" className="flex items-center justify-center gap-2 bg-[#D97706] py-1.5 text-[13px] font-medium text-white">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reconnecting…
        </div>
      )}
      {needsAudioUnlock && (
        <button
          onClick={onUnlockAudio}
          className="flex w-full items-center justify-center gap-2 bg-[var(--color-brand-blue)] py-1.5 text-[13px] font-medium text-white"
        >
          <Volume2 className="h-3.5 w-3.5" /> Click to enable meeting audio
        </button>
      )}
      {mediaError && (
        <div role="alert" className="flex items-center justify-center gap-2 bg-[#78350F] py-1.5 text-[13px] text-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {mediaError}
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 p-4">
          {activeShare ? (
            <div className="flex h-full gap-3">
              <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-black">
                <VideoTrack trackRef={activeShare} className="h-full w-full object-contain" />
              </div>
              <div className="hidden w-48 shrink-0 flex-col gap-3 overflow-y-auto lg:flex">
                {orderedTiles.map((t) => (
                  <ParticipantTile key={`${t.participant.identity}-cam`} trackRef={t} compact />
                ))}
              </div>
            </div>
          ) : (
            <div className={`grid h-full auto-rows-fr gap-3 ${gridClassFor(orderedTiles.length)}`}>
              {orderedTiles.map((t) => (
                <ParticipantTile key={`${t.participant.identity}-cam`} trackRef={t} />
              ))}
            </div>
          )}
        </main>

        {/* ── Sidebar ── */}
        {sidebar && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-[var(--color-border-default)]">
            <div className="flex border-b border-[var(--color-border-default)]">
              {(["chat", "participants"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebar(tab)}
                  className={`flex-1 py-3 text-[13px] font-medium capitalize transition-colors ${
                    sidebar === tab
                      ? "border-b-2 border-[var(--color-brand-blue)] text-[var(--color-brand-blue)]"
                      : "text-[var(--color-text-secondary)] hover:text-white"
                  }`}
                >
                  {tab === "participants" ? `People (${participants.length})` : "Chat"}
                </button>
              ))}
            </div>

            {sidebar === "chat" ? (
              <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                  {messages.length === 0 ? (
                    <p className="mt-8 text-center text-[13px] text-[var(--color-text-secondary)]">
                      Messages are visible to everyone in the call and are not saved after it ends.
                    </p>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={m.isOwn ? "text-right" : ""}>
                        <p className="mb-0.5 text-[11px] text-[var(--color-text-secondary)]">
                          {m.senderName} ·{" "}
                          {new Date(m.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p
                          className={`inline-block max-w-[85%] break-words rounded-lg px-3 py-1.5 text-left text-[13px] ${
                            m.isOwn
                              ? "bg-[var(--color-brand-blue)] text-white"
                              : "bg-[var(--color-surface-light)] text-[var(--color-text-primary)]"
                          }`}
                        >
                          {m.text}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form
                  className="flex gap-2 border-t border-[var(--color-border-default)] p-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendChat()
                  }}
                >
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send a message"
                    aria-label="Message"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:border-[var(--color-brand-blue)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    aria-label="Send message"
                    className="rounded-lg bg-[var(--color-brand-blue)] px-3 text-white disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {participants.map((p) => {
                  const pHost = roleOf(p.metadata) === "HOST"
                  const canManage = isHost && !p.isLocal
                  return (
                    <div
                      key={p.identity}
                      className="group relative flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--color-surface-light)]"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: avatarColorOf(p.identity) }}
                      >
                        {initialsOf(p.name || p.identity)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-[var(--color-text-primary)]">
                          {p.name || p.identity}
                          {p.isLocal && " (You)"}
                        </p>
                        {pHost && <p className="text-[11px] text-[#F59E0B]">Host</p>}
                      </div>
                      {!p.isMicrophoneEnabled && <MicOff className="h-3.5 w-3.5 shrink-0 text-[#EF4444]" />}
                      {!p.isCameraEnabled && <VideoOff className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]" />}

                      {canManage && (
                        <>
                          <button
                            onClick={() => setMenuFor(menuFor === p.identity ? null : p.identity)}
                            aria-label={`Manage ${p.name || "participant"}`}
                            className="shrink-0 text-[var(--color-text-secondary)] hover:text-white"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {menuFor === p.identity && (
                            <div className="absolute right-2 top-10 z-30 w-52 overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] shadow-xl">
                              <button
                                onClick={() => muteParticipant(p as RemoteParticipant, "microphone")}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-light)]"
                              >
                                <MicOff className="h-3.5 w-3.5" /> Mute microphone
                              </button>
                              <button
                                onClick={() => muteParticipant(p as RemoteParticipant, "camera")}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-light)]"
                              >
                                <VideoOff className="h-3.5 w-3.5" /> Turn off camera
                              </button>
                              <button
                                onClick={() => {
                                  setMenuFor(null)
                                  setRemoveTarget(p as RemoteParticipant)
                                }}
                                className="flex w-full items-center gap-2 border-t border-[var(--color-border-default)] px-3 py-2 text-left text-[13px] text-[#EF4444] hover:bg-[var(--color-surface-light)]"
                              >
                                <UserX className="h-3.5 w-3.5" /> Remove from meeting
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={copyInvite}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-light)] py-2.5 text-[13px] font-semibold text-[var(--color-brand-blue)]"
                >
                  <Users className="h-4 w-4" /> Copy invite link
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── Control bar ── */}
      <footer className="flex h-20 shrink-0 items-center justify-center gap-3 border-t border-[var(--color-border-default)]">
        <ControlButton active={isMicrophoneEnabled} onClick={toggleMic} label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}>
          {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton active={isCameraEnabled} onClick={toggleCamera} label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}>
          {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton
          active
          highlighted={isScreenShareEnabled}
          onClick={toggleShare}
          label={isScreenShareEnabled ? "Stop presenting" : "Present your screen"}
          disabled={!isScreenShareEnabled && !!activeShare}
        >
          <MonitorUp className="h-5 w-5" />
        </ControlButton>

        <div className="mx-2 h-8 w-px bg-[var(--color-border-default)]" />

        <ControlButton
          active
          highlighted={sidebar === "chat"}
          onClick={() => setSidebar(sidebar === "chat" ? null : "chat")}
          label="Toggle chat"
          badge={unread || undefined}
        >
          <MessageSquare className="h-5 w-5" />
        </ControlButton>
        <ControlButton
          active
          highlighted={sidebar === "participants"}
          onClick={() => setSidebar(sidebar === "participants" ? null : "participants")}
          label="Toggle participant list"
        >
          <Users className="h-5 w-5" />
        </ControlButton>
        <ControlButton active highlighted={showSettings} onClick={() => setShowSettings(true)} label="Audio and video settings">
          <Settings className="h-5 w-5" />
        </ControlButton>

        <button
          onClick={() => (isHost ? setShowLeaveModal(true) : leave())}
          className="ml-2 flex h-12 items-center gap-2 rounded-full bg-[#EF4444] px-6 font-semibold text-white transition-colors hover:bg-[#DC2626]"
        >
          <PhoneOff className="h-5 w-5" /> Leave
        </button>
      </footer>

      {/* ── Host leave / end modal ── */}
      {showLeaveModal && (
        <Modal onClose={() => setShowLeaveModal(false)} title="Leave the meeting?">
          <p className="mb-6 text-center text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
            You can leave and let the meeting continue, or end it for everyone.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={leave}
              className="h-11 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[14px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-light)]"
            >
              Just leave
            </button>
            <button
              onClick={endForEveryone}
              disabled={busy}
              className="h-11 rounded-lg bg-[#EF4444] text-[14px] font-medium text-white hover:bg-[#DC2626] disabled:opacity-60"
            >
              {busy ? "Ending…" : "End meeting for everyone"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Device settings ── */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Audio and video">
          {devices.cameras.length === 0 && devices.microphones.length === 0 ? (
            <p className="text-center text-[14px] text-[var(--color-text-secondary)]">
              No cameras or microphones were found. Check that your browser has permission to use them.
            </p>
          ) : (
            <div className="space-y-4">
              {devices.microphones.length > 0 && (
                <div>
                  <label htmlFor="room-mic" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Microphone
                  </label>
                  <select
                    id="room-mic"
                    value={devices.activeMicrophoneId ?? ""}
                    onChange={(e) => switchDevice("audioinput", e.target.value)}
                    className="h-10 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 text-[13px] text-[var(--color-text-primary)] focus:border-[var(--color-brand-blue)] focus:outline-none"
                  >
                    {devices.microphones.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>
                    ))}
                  </select>
                </div>
              )}

              {devices.cameras.length > 0 && (
                <div>
                  <label htmlFor="room-cam" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Camera
                  </label>
                  <select
                    id="room-cam"
                    value={devices.activeCameraId ?? ""}
                    onChange={(e) => switchDevice("videoinput", e.target.value)}
                    className="h-10 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 text-[13px] text-[var(--color-text-primary)] focus:border-[var(--color-brand-blue)] focus:outline-none"
                  >
                    {devices.cameras.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>
                    ))}
                  </select>
                </div>
              )}

              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Changes apply straight away and are remembered for your next meeting.
              </p>
            </div>
          )}
        </Modal>
      )}

      {/* ── Remove participant modal ── */}
      {removeTarget && (
        <Modal
          onClose={() => {
            setRemoveTarget(null)
            setBanOnRemove(false)
          }}
          title={`Remove ${removeTarget.name || "participant"}?`}
        >
          <p className="mb-5 text-center text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
            They will be disconnected from this meeting immediately.
          </p>
          <label className="mb-6 flex items-center justify-center gap-2 text-[14px] text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={banOnRemove}
              onChange={(e) => setBanOnRemove(e.target.checked)}
              className="rounded border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-brand-blue)]"
            />
            Also prevent them from rejoining
          </label>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setRemoveTarget(null)
                setBanOnRemove(false)
              }}
              className="h-10 rounded-lg border border-[var(--color-border-default)] px-4 text-[14px] font-medium text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
            <button
              onClick={confirmRemove}
              disabled={busy}
              className="h-10 rounded-lg bg-[#EF4444] px-4 text-[14px] font-medium text-white hover:bg-[#DC2626] disabled:opacity-60"
            >
              {busy ? "Removing…" : "Remove"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Small building blocks ──────────────────────────────────────────

function ControlButton({
  children, onClick, active, highlighted, label, disabled, badge,
}: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  highlighted?: boolean
  label: string
  disabled?: boolean
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={highlighted}
      className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        !active
          ? "bg-[#EF4444] text-white hover:bg-[#DC2626]"
          : highlighted
            ? "bg-[var(--color-brand-blue)] text-white"
            : "bg-[var(--color-surface-light)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-card)]"
      }`}
    >
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  )
}

function Modal({
  children, onClose, title,
}: {
  children: React.ReactNode
  onClose: () => void
  title: string
}) {
  // Escape closes, matching what people expect from a dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-8 shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-[var(--color-text-secondary)] hover:text-white"
        >
          <XCircle className="h-5 w-5" />
        </button>
        <h2 className="mb-4 text-center font-display text-[20px] font-semibold text-white">{title}</h2>
        {children}
      </div>
    </div>
  )
}
