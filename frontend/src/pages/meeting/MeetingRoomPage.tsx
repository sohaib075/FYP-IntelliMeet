import { Suspense, lazy } from "react"
import { Navigate, useParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { normalizeMeetingId } from "@/lib/meetingId"

// The LiveKit SDK is large and only needed inside a meeting, so both room
// implementations are split out of the main bundle.
const LiveKitMeetingRoom = lazy(() =>
  import("./LiveKitMeetingRoom").then((m) => ({ default: m.LiveKitMeetingRoom }))
)
const MeshMeetingRoom = lazy(() =>
  import("./MeshMeetingRoom").then((m) => ({ default: m.MeshMeetingRoom }))
)

function RoomLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg-primary)]">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-blue)]" />
      <p className="text-sm text-[var(--color-text-secondary)]">Loading the meeting room…</p>
    </div>
  )
}

/**
 * Chooses the media layer for this meeting.
 *
 * The room always tries LiveKit first: it asks the API for a token, which is
 * also the only place a join is authorised. If the backend reports that no
 * media server is configured (LIVEKIT_NOT_CONFIGURED), it falls back to the
 * original peer-to-peer mesh so the app keeps working during the migration.
 *
 * Once LiveKit is set up in every environment, delete MeshMeetingRoom.tsx,
 * the fallback prop below, and the Socket.IO signalling code it depends on.
 */
export function MeetingRoomPage() {
  const { meetingId: raw } = useParams()
  const meetingId = normalizeMeetingId(raw)

  // A malformed code never reaches the media layer. The lobby explains why.
  if (!meetingId) {
    return <Navigate to={raw ? `/meet/${raw}` : "/join"} replace />
  }

  return (
    <Suspense fallback={<RoomLoading />}>
      <LiveKitMeetingRoom
        meetingId={meetingId}
        fallback={
          <Suspense fallback={<RoomLoading />}>
            <MeshMeetingRoom />
          </Suspense>
        }
      />
    </Suspense>
  )
}
