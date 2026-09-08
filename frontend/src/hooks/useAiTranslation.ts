import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Track, RoomEvent, TrackEvent, type Room, type RemoteParticipant } from 'livekit-client'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useTextToSpeech } from './useTextToSpeech'
import { aiApi, describeApiError, type AiConfig } from '@/lib/api'
import { getLanguage } from '@/lib/languages'

/**
 * ============================================================
 * AI translation orchestrator
 * ============================================================
 * Owns the whole pipeline and all of its state:
 *
 *   my mic ─ STT ─→ my final utterance ─→ data channel (topic "transcript")
 *                                              │
 *   someone else's utterance ←─────────────────┘
 *        └─→ translate into MY target language ─→ display ─→ TTS to MY speakers
 *
 * The design point worth stating: translation and speech happen on the
 * RECEIVING side. Each participant recognises their own speech once and
 * broadcasts plain text; each listener translates that text into the one
 * language they personally chose. Three listeners wanting three languages
 * cost three translations, not nine, and nobody pays for a language nobody
 * selected. It also means your own words are never translated or spoken back
 * at you, which removes the most obvious feedback path by construction.
 * ============================================================
 */

export interface TranscriptLine {
  id: string
  /** Display name of whoever spoke. */
  speaker: string
  /** True when this is the local user — their own speech is not translated. */
  isLocal: boolean
  /** Language the speaker was talking in. */
  sourceLang: string
  /**
   * Language this line was translated INTO — the local user's choice at the
   * moment it arrived. Stored per line so that changing the target language
   * mid-meeting does not retroactively mislabel (or re-render right-to-left)
   * lines that were already translated into the previous language.
   */
  targetLang: string
  original: string
  translated: string | null
  status: 'pending' | 'done' | 'failed'
}

/** Wire format for the "transcript" data-channel topic. */
interface TranscriptPacket {
  text: string
  lang: string
}

/** Its own topic, so the existing chat handler ignores it (it already guards on topic). */
const TRANSCRIPT_TOPIC = 'transcript'

/** Keep the panel bounded; matches the chat ring buffer's intent. */
const MAX_LINES = 100

/** Below this, a "sentence" is almost always a stray noise artefact. */
const MIN_UTTERANCE_CHARS = 2

/**
 * Tracks the live local microphone track across LiveKit's lifecycle.
 *
 * Mute leaves the track in place (LiveKit only flips `enabled`), but a device
 * switch REPLACES it and fires TrackEvent.Restarted. Returning the current
 * MediaStreamTrack as state means the recogniser rebuilds itself exactly when
 * the underlying track changes, and not otherwise.
 */
function useLocalMicTrack(room: Room | null, active: boolean): MediaStreamTrack | null {
  const [track, setTrack] = useState<MediaStreamTrack | null>(null)

  useEffect(() => {
    if (!room || !active) {
      setTrack(null)
      return
    }

    const read = () =>
      room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack
        ?.mediaStreamTrack ?? null

    const sync = () => setTrack((current) => {
      const next = read()
      return current === next ? current : next
    })

    sync()

    // The publication's own track object is replaced on restart, so re-read
    // on any local publication change as well as on an explicit restart.
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone)
    const localTrack = pub?.audioTrack

    localTrack?.on(TrackEvent.Restarted, sync)
    room.on(RoomEvent.LocalTrackPublished, sync)
    room.on(RoomEvent.LocalTrackUnpublished, sync)
    room.on(RoomEvent.ActiveDeviceChanged, sync)

    return () => {
      localTrack?.off(TrackEvent.Restarted, sync)
      room.off(RoomEvent.LocalTrackPublished, sync)
      room.off(RoomEvent.LocalTrackUnpublished, sync)
      room.off(RoomEvent.ActiveDeviceChanged, sync)
    }
  }, [room, active])

  return track
}

interface Options {
  room: Room | null
  /** Seeded from the lobby choice / saved preferences. */
  initialSourceLang: string
  initialTargetLang: string
}

export function useAiTranslation({ room, initialSourceLang, initialTargetLang }: Options) {
  const [enabled, setEnabled] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [sourceLang, setSourceLang] = useState(initialSourceLang)
  const [targetLang, setTargetLang] = useState(initialTargetLang)

  const [config, setConfig] = useState<AiConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [interim, setInterim] = useState('')
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [error, setError] = useState<string | null>(null)

  const lineSeq = useRef(0)
  const nextId = () => `line-${++lineSeq.current}`

  // ---- capability probe -------------------------------------------------
  // Ask once what this deployment can do, so the UI can explain that the
  // feature is unconfigured instead of failing when the user flips it on.
  useEffect(() => {
    let cancelled = false
    aiApi
      .getConfig()
      .then((c) => {
        if (!cancelled) setConfig(c)
      })
      .catch((err) => {
        if (!cancelled) setConfigError(describeApiError(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const speechAvailable = config?.speechEnabled ?? false
  const translationAvailable = config?.translationEnabled ?? false
  const available = speechAvailable && translationAvailable

  const tts = useTextToSpeech(enabled && voiceEnabled)
  const micTrack = useLocalMicTrack(room, enabled && speechAvailable)

  const pushLine = useCallback((line: TranscriptLine) => {
    setLines((prev) => [...prev, line].slice(-MAX_LINES))
  }, [])

  // ---- my speech: recognise, then broadcast ------------------------------
  const handleFinal = useCallback(
    (text: string) => {
      setInterim('')
      if (text.trim().length < MIN_UTTERANCE_CHARS) return

      // Show my own words locally. Deliberately NOT translated and NOT spoken:
      // I already know what I said, and synthesising it would put my own voice
      // back into my own microphone.
      pushLine({
        id: nextId(),
        speaker: 'You',
        isLocal: true,
        sourceLang,
        targetLang,
        original: text,
        translated: null,
        status: 'done',
      })

      if (!room) return
      try {
        const packet: TranscriptPacket = { text, lang: sourceLang }
        void room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(packet)),
          { reliable: true, topic: TRANSCRIPT_TOPIC }
        )
      } catch (err) {
        // Losing a transcript must never disturb the call itself.
        console.error('[AI] Failed to broadcast transcript:', err)
      }
    },
    [room, sourceLang, targetLang, pushLine]
  )

  useSpeechRecognition({
    enabled: enabled && speechAvailable && !!room,
    languageCode: sourceLang,
    micTrack,
    onInterim: setInterim,
    onFinal: handleFinal,
    onError: setError,
    // Anything heard while our own translated audio is playing is discarded,
    // which is what stops TTS output being re-recognised and re-translated.
    shouldDiscard: tts.isOutputAudible,
  })

  // ---- their speech: translate into MY language, then speak --------------
  useEffect(() => {
    if (!room || !enabled) return

    const onData = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic !== TRANSCRIPT_TOPIC) return

      let packet: TranscriptPacket
      try {
        packet = JSON.parse(new TextDecoder().decode(payload))
      } catch {
        return // malformed packet from a peer must not break the room
      }
      if (typeof packet?.text !== 'string' || !packet.text.trim()) return

      // Identity comes from LiveKit, never from the payload — the same
      // anti-spoofing rule the chat handler already follows.
      const speaker = participant?.name || participant?.identity || 'Participant'
      const id = nextId()

      pushLine({
        id,
        speaker,
        isLocal: false,
        sourceLang: packet.lang,
        targetLang,
        original: packet.text,
        translated: null,
        status: 'pending',
      })

      if (!translationAvailable) {
        setLines((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: 'failed' as const } : l))
        )
        return
      }

      console.log(`[AI] Translating ${packet.lang} → ${targetLang}`)
      aiApi
        .translate({
          text: packet.text,
          sourceLanguage: packet.lang,
          targetLanguage: targetLang,
        })
        .then(({ translatedText }) => {
          console.log('[AI] Translation completed')
          setLines((prev) =>
            prev.map((l) =>
              l.id === id ? { ...l, translated: translatedText, status: 'done' as const } : l
            )
          )
          // Voice is a separate switch: a TTS failure leaves the text intact.
          tts.speak(translatedText, targetLang)
        })
        .catch((err) => {
          console.error('[AI] Translation failed:', err)
          setError(describeApiError(err))
          setLines((prev) =>
            prev.map((l) => (l.id === id ? { ...l, status: 'failed' as const } : l))
          )
        })
    }

    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room, enabled, targetLang, translationAvailable, pushLine, tts])

  // ---- switching off releases everything ---------------------------------
  useEffect(() => {
    if (enabled) return
    setInterim('')
    setError(null)
    tts.stop()
    // Lines are kept: turning the feature off should not erase what was said.
  }, [enabled, tts])

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on
      console.log(`[AI] Translation ${next ? 'enabled' : 'disabled'}`)
      return next
    })
  }, [])

  /** A single reason the feature cannot run, or null when it can. */
  const unavailableReason = useMemo(() => {
    if (configError) return configError
    if (!config) return null
    if (!config.speechEnabled && !config.translationEnabled)
      return 'AI translation is not configured on this server.'
    if (!config.speechEnabled) return 'Speech recognition is not configured on this server.'
    if (!config.translationEnabled) return 'Translation is not configured on this server.'
    return null
  }, [config, configError])

  return {
    // state
    enabled,
    voiceEnabled,
    sourceLang,
    targetLang,
    interim,
    lines,
    error: error || tts.error,
    isSpeaking: tts.isSpeaking,
    available,
    unavailableReason,
    ready: config !== null || configError !== null,
    targetIsRtl: getLanguage(targetLang).rtl,

    // actions
    toggle,
    setEnabled,
    setVoiceEnabled,
    setSourceLang,
    setTargetLang,
    clearError: () => {
      setError(null)
      tts.clearError()
    },
  }
}
