import { useEffect, useRef, useState, useCallback } from 'react'
import { RoomEvent, type DisconnectReason } from 'livekit-client'
import { createRoom, mapDisconnectReason, type EndReason, type Room } from '@/lib/livekit'
import { meetingApi, describeApiError, toApiError, type MeetingDto } from '@/lib/api'
import { getStoredDevices } from '@/hooks/useMediaDevices'

/**
 * Lifecycle of one LiveKit session.
 *
 *   loading      — asking the API to authorise us and mint a token
 *   unavailable  — LiveKit is not configured; caller should use the legacy mesh
 *   error        — the API refused (not found / ended / banned / locked)
 *   connecting   — token in hand, opening the media connection
 *   connected    — live
 *   reconnecting — transient network loss; the SDK is retrying
 *   ended        — session over; caller navigates to the ended page
 */
export type MeetingPhase =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error'; code: string | null; message: string }
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'reconnecting' }
  | { kind: 'ended'; reason: EndReason }

interface Options {
  /** Publish the microphone on join (from the lobby toggle) */
  micOn: boolean
  /** Publish the camera on join (from the lobby toggle) */
  cameraOn: boolean
}

/**
 * De-duplicates concurrent token requests for the same join attempt.
 *
 * React StrictMode runs this hook's effect twice in development, and a user
 * can double-click Join in production. Without this, each of those fires its
 * own POST /token. The backend is idempotent, so duplicates are harmless, but
 * they waste a round trip and make the dev logs confusing.
 */
const inFlightTokens = new Map<string, Promise<Awaited<ReturnType<typeof meetingApi.token>>>>()

function requestToken(meetingId: string, attempt: number) {
  const key = `${meetingId}:${attempt}`
  const existing = inFlightTokens.get(key)
  if (existing) return existing

  const pending = meetingApi.token(meetingId)
  inFlightTokens.set(key, pending)
  // Keep it briefly so the StrictMode remount reuses it, then let it go so a
  // genuine retry later asks the server again.
  pending
    .catch(() => {})
    .finally(() => {
      setTimeout(() => inFlightTokens.delete(key), 3000)
    })
  return pending
}

/**
 * Owns the Room instance for one meeting: authorises with the API, connects,
 * publishes the lobby's chosen media, and reports connection lifecycle.
 *
 * Identity and role come from the server-signed token, so a client cannot
 * claim to be someone else or promote itself to host.
 */
export function useLiveKitMeeting(meetingId: string | null, { micOn, cameraOn }: Options) {
  const [room] = useState<Room>(() => createRoom())
  const [phase, setPhase] = useState<MeetingPhase>({ kind: 'loading' })
  const [meeting, setMeeting] = useState<MeetingDto | null>(null)
  const [role, setRole] = useState<'HOST' | 'PARTICIPANT'>('PARTICIPANT')
  const [identity, setIdentity] = useState<string>('')
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // Keep the join-time media choice out of the effect's dependencies so a
  // toggle during the call never tears the connection down and rebuilds it.
  const joinPrefs = useRef({ micOn, cameraOn })

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!meetingId) {
      setPhase({ kind: 'error', code: 'INVALID_MEETING_ID', message: 'No meeting code was provided.' })
      return
    }

    let cancelled = false
    let connected = false

    const onDisconnected = (reason?: DisconnectReason) => {
      if (cancelled) return
      setPhase({ kind: 'ended', reason: mapDisconnectReason(reason) })
    }
    const onReconnecting = () => !cancelled && setPhase({ kind: 'reconnecting' })
    const onReconnected = () => !cancelled && setPhase({ kind: 'connected' })
    const onAudioPlayback = () => !cancelled && setNeedsAudioUnlock(!room.canPlaybackAudio)

    room.on(RoomEvent.Disconnected, onDisconnected)
    room.on(RoomEvent.Reconnecting, onReconnecting)
    room.on(RoomEvent.Reconnected, onReconnected)
    room.on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlayback)

    const run = async () => {
      setPhase({ kind: 'loading' })
      setMediaError(null)

      // ---- 1. Authorise. The server refuses unknown, ended, locked and
      //         banned meetings here, so no room is ever created by mistake.
      let token: Awaited<ReturnType<typeof meetingApi.token>>
      try {
        token = await requestToken(meetingId, attempt)
      } catch (err) {
        if (cancelled) return
        const e = toApiError(err)
        if (e.code === 'LIVEKIT_NOT_CONFIGURED') setPhase({ kind: 'unavailable' })
        else setPhase({ kind: 'error', code: e.code, message: describeApiError(err) })
        return
      }
      if (cancelled) return

      setMeeting(token.meeting)
      setRole(token.role)
      setIdentity(token.identity)
      setPhase({ kind: 'connecting' })

      // ---- 2. Connect to the SFU.
      try {
        await room.connect(token.url, token.token)
        connected = true
      } catch (err) {
        if (cancelled) return
        setPhase({
          kind: 'error',
          code: 'LIVEKIT_CONNECTION_ERROR',
          message: "Couldn't reach the meeting server. Check your connection and try again.",
        })
        return
      }
      if (cancelled) {
        room.disconnect()
        return
      }

      setPhase({ kind: 'connected' })
      setNeedsAudioUnlock(!room.canPlaybackAudio)

      // ---- 3. Publish what the lobby asked for. A device failure here is
      //         not fatal: you can still see and hear everyone else.
      //
      // Microphone and camera get their own try/catch, otherwise a mic
      // failure would skip the camera entirely. Each step re-checks
      // `cancelled`, so leaving mid-publish does not switch a device on
      // after the user has already gone.
      const failed = []
      // Publish with whichever camera and microphone the person chose in the
      // lobby, so their headset selection carries into the call.
      const chosen = getStoredDevices()

      if (joinPrefs.current.micOn && !cancelled) {
        try {
          await room.localParticipant.setMicrophoneEnabled(
            true,
            chosen.audioinput ? { deviceId: { ideal: chosen.audioinput } } : undefined
          )
        } catch {
          failed.push('microphone')
        }
      }

      if (joinPrefs.current.cameraOn && !cancelled) {
        try {
          await room.localParticipant.setCameraEnabled(
            true,
            chosen.videoinput ? { deviceId: { ideal: chosen.videoinput } } : undefined
          )
        } catch {
          failed.push('camera')
        }
      }

      if (cancelled) {
        // The user left while devices were starting up. Disconnecting also
        // releases anything that did manage to start, so the camera light
        // goes out instead of lingering.
        room.disconnect()
        return
      }

      if (failed.length) {
        setMediaError(
          `We could not turn on your ${failed.join(' or ')}. Check your browser permissions, then use the controls below.`
        )
      }
    }

    run()

    return () => {
      cancelled = true
      room.off(RoomEvent.Disconnected, onDisconnected)
      room.off(RoomEvent.Reconnecting, onReconnecting)
      room.off(RoomEvent.Reconnected, onReconnected)
      room.off(RoomEvent.AudioPlaybackStatusChanged, onAudioPlayback)
      // Always tear the session down: this stops the camera light and
      // releases the SFU slot even when the user hits the browser Back button.
      if (connected) room.disconnect()
    }
  }, [meetingId, attempt, room])

  /** Safari and iOS block audio until a user gesture; call this from a click. */
  const unlockAudio = useCallback(async () => {
    try {
      await room.startAudio()
      setNeedsAudioUnlock(!room.canPlaybackAudio)
    } catch {
      /* the button stays visible so the user can try again */
    }
  }, [room])

  return { room, phase, meeting, role, identity, mediaError, needsAudioUnlock, unlockAudio, retry }
}
