import {
  VideoTrack,
  useIsSpeaking,
  useIsMuted,
  useConnectionQualityIndicator,
  isTrackReference,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react'
import { Track, ConnectionQuality } from 'livekit-client'
import { MicOff, Crown, MonitorUp, SignalLow, SignalZero } from 'lucide-react'
import { roleOf, initialsOf, avatarColorOf } from '@/lib/livekit'

interface Props {
  trackRef: TrackReferenceOrPlaceholder
  /** Compact styling for the filmstrip beside a shared screen */
  compact?: boolean
}

/**
 * One person in the grid. Renders their camera when it is published and
 * unmuted, otherwise an avatar. The host badge comes from token metadata,
 * which is signed by the server.
 */
export function ParticipantTile({ trackRef, compact = false }: Props) {
  const participant = trackRef.participant
  const isSpeaking = useIsSpeaking(participant)

  // A placeholder ref lets us ask about the mic without a published track.
  const micRef: TrackReferenceOrPlaceholder = {
    participant,
    source: Track.Source.Microphone,
    publication: participant.getTrackPublication(Track.Source.Microphone),
  }
  const isMuted = useIsMuted(micRef)

  // Only surfaced when it is actually bad. A permanently green "good signal"
  // badge is noise that people stop reading, so it would not warn anyone.
  const { quality } = useConnectionQualityIndicator({ participant })
  const poorConnection = quality === ConnectionQuality.Poor
  const lostConnection = quality === ConnectionQuality.Lost

  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted
  const isHost = roleOf(participant.metadata) === 'HOST'
  const isLocal = participant.isLocal
  const name = participant.name || participant.identity
  const isSharing = !!participant.getTrackPublication(Track.Source.ScreenShare)

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[var(--color-bg-primary)] border transition-colors ${
        isSpeaking && !isMuted
          ? 'border-[#10B981] shadow-[0_0_0_2px_rgba(16,185,129,0.25)]'
          : 'border-[var(--color-border-default)]'
      } ${compact ? 'aspect-video' : 'h-full w-full'}`}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          // Mirror your own camera so moving left looks like moving left.
          className={`h-full w-full object-cover ${isLocal ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className={`flex items-center justify-center rounded-full font-bold text-white ${
              compact ? 'h-12 w-12 text-sm' : 'h-20 w-20 text-2xl'
            }`}
            style={{ backgroundColor: avatarColorOf(participant.identity) }}
            aria-hidden="true"
          >
            {initialsOf(name)}
          </div>
        </div>
      )}

      {/* Name plate */}
      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-md">
        {isMuted && <MicOff className="h-3.5 w-3.5 shrink-0 text-[#EF4444]" aria-label="Muted" />}
        <span className="truncate text-[12px] font-medium text-white">
          {name}
          {isLocal && ' (You)'}
        </span>
        {isHost && <Crown className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" aria-label="Host" />}
        {isSharing && <MonitorUp className="h-3.5 w-3.5 shrink-0 text-[#3B82F6]" aria-label="Presenting" />}
        {poorConnection && (
          <SignalLow className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" aria-label="Weak connection" />
        )}
        {lostConnection && (
          <SignalZero className="h-3.5 w-3.5 shrink-0 text-[#EF4444]" aria-label="Connection lost" />
        )}
      </div>
    </div>
  )
}
