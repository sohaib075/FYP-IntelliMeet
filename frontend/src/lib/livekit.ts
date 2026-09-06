import { Room, RoomEvent, DisconnectReason, type RoomOptions } from 'livekit-client'

/**
 * Room options used for every meeting.
 *
 * `adaptiveStream` drops the resolution of tiles that are small or offscreen,
 * and `dynacast` stops sending layers nobody subscribes to. Together they are
 * what let an SFU carry many more participants than a peer-to-peer mesh.
 */
export const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    // Simulcast lets each subscriber pick the layer their bandwidth allows.
    simulcast: true,
    videoCodec: 'vp8',
    red: true,
    dtx: true,
  },
  videoCaptureDefaults: {
    resolution: { width: 1280, height: 720, frameRate: 30 },
  },
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  // Stop the camera light when a track is unpublished.
  stopLocalTrackOnUnpublish: true,
}

export function createRoom(): Room {
  return new Room(ROOM_OPTIONS)
}

/** Why a session ended, in terms the UI can explain to a person. */
export type EndReason = 'ended' | 'removed' | 'removed-blocked' | 'duplicate' | 'left' | 'lost'

/** Map LiveKit's numeric disconnect reason onto our ended-page reasons. */
export function mapDisconnectReason(reason?: DisconnectReason): EndReason {
  switch (reason) {
    case DisconnectReason.PARTICIPANT_REMOVED:
      return 'removed'
    case DisconnectReason.ROOM_DELETED:
      return 'ended'
    case DisconnectReason.DUPLICATE_IDENTITY:
      return 'duplicate'
    case DisconnectReason.CLIENT_INITIATED:
      return 'left'
    default:
      return 'lost'
  }
}

/** Role carried in participant metadata. Display only — the server re-checks. */
export function roleOf(metadata?: string): 'HOST' | 'PARTICIPANT' {
  if (!metadata) return 'PARTICIPANT'
  try {
    const parsed = JSON.parse(metadata) as { role?: string }
    return parsed.role === 'HOST' ? 'HOST' : 'PARTICIPANT'
  } catch {
    return 'PARTICIPANT'
  }
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Deterministic tile accent so the same person keeps the same colour. */
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4']
export function avatarColorOf(identity: string): string {
  let hash = 0
  for (let i = 0; i < identity.length; i += 1) hash = (hash * 31 + identity.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export { Room, RoomEvent, DisconnectReason }
