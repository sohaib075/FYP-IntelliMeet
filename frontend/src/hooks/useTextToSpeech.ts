import { useCallback, useEffect, useRef, useState } from 'react'
import { loadSpeechSDK, createSpeechConfig, invalidateSpeechToken } from '@/lib/speechClient'
import { getLanguage } from '@/lib/languages'

/**
 * ============================================================
 * Azure Neural TTS playback
 * ============================================================
 * Synthesises translated text and plays it through an audio element this hook
 * owns.
 *
 * Why not `AudioConfig.fromDefaultSpeakerOutput()`: the SDK's internal player
 * gives no handle to stop playback, no way to know when it finishes, and no
 * element to point at a chosen output device. We need all three — to stop
 * cleanly when AI is switched off, to gate recognition while audio is
 * audible, and to keep the whole thing out of LiveKit's audio path.
 *
 * Critically, this audio is NEVER published as a LiveKit track. The room's
 * <RoomAudioRenderer /> subscribes to Track.Source.Unknown, so a published
 * TTS track would be auto-played to every participant in their own language.
 * Playback stays local to the listener who asked for it.
 * ============================================================
 */

interface QueueItem {
  text: string
  languageCode: string
}

/** How long after audio ends to keep suppressing recognition, for room echo. */
const ECHO_TAIL_MS = 400

export function useTextToSpeech(enabled: boolean) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<QueueItem[]>([])
  const drainingRef = useRef(false)
  /** Epoch ms until which recognition results should be discarded. */
  const suppressUntilRef = useRef(0)

  // One element for the lifetime of the hook.
  useEffect(() => {
    const el = new Audio()
    el.preload = 'auto'
    audioRef.current = el
    return () => {
      el.pause()
      if (el.src) URL.revokeObjectURL(el.src)
      audioRef.current = null
    }
  }, [])

  /** True while our own audio is audible (plus a short tail for room echo). */
  const isOutputAudible = useCallback(() => Date.now() < suppressUntilRef.current, [])

  /** Synthesise one item to a Blob and await playback. */
  const playOne = useCallback(async ({ text, languageCode }: QueueItem) => {
    const sdk = await loadSpeechSDK()
    const speechConfig = await createSpeechConfig(sdk)
    speechConfig.speechSynthesisVoiceName = getLanguage(languageCode).voice

    // null audioConfig => the SDK hands back the audio instead of playing it.
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null as never)

    let audioData: ArrayBuffer
    try {
      audioData = await new Promise<ArrayBuffer>((resolve, reject) => {
        synthesizer.speakTextAsync(
          text,
          (result) => {
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              resolve(result.audioData)
            } else {
              reject(new Error(result.errorDetails || 'Synthesis failed'))
            }
          },
          (err) => reject(new Error(String(err)))
        )
      })
    } finally {
      try {
        synthesizer.close()
      } catch {
        /* already closed */
      }
    }

    const el = audioRef.current
    if (!el) return

    const url = URL.createObjectURL(new Blob([audioData], { type: 'audio/mpeg' }))
    const previous = el.src
    el.src = url
    if (previous) URL.revokeObjectURL(previous)

    // Hold the suppression window open across synthesis AND playback, so a
    // result recognised at any point in between is discarded.
    suppressUntilRef.current = Date.now() + 30_000

    try {
      await el.play()
      console.log('[AI] TTS playback started')
      await new Promise<void>((resolve) => {
        const done = () => {
          el.removeEventListener('ended', done)
          el.removeEventListener('error', done)
          resolve()
        }
        el.addEventListener('ended', done)
        el.addEventListener('error', done)
      })
    } finally {
      suppressUntilRef.current = Date.now() + ECHO_TAIL_MS
    }
  }, [])

  /** Play queued items one at a time, so translations never overlap. */
  const drain = useCallback(async () => {
    if (drainingRef.current) return
    drainingRef.current = true
    setIsSpeaking(true)

    try {
      while (queueRef.current.length > 0) {
        const item = queueRef.current.shift()!
        try {
          await playOne(item)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[AI] TTS failed:', message)

          if (/401|forbidden|token/i.test(message)) invalidateSpeechToken()

          // A TTS failure must not hide the translation. The caller has
          // already displayed the text; surface the voice problem only.
          setError('Voice playback unavailable. Text translation is still shown.')
        }
      }
    } finally {
      drainingRef.current = false
      setIsSpeaking(false)
    }
  }, [playOne])

  /** Queue a translated line for speech. No-op when voice output is off. */
  const speak = useCallback(
    (text: string, languageCode: string) => {
      if (!enabled) return
      const trimmed = text.trim()
      if (!trimmed) return

      queueRef.current.push({ text: trimmed, languageCode })
      void drain()
    },
    [enabled, drain]
  )

  /** Stop immediately and drop anything pending. */
  const stop = useCallback(() => {
    queueRef.current = []
    const el = audioRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    suppressUntilRef.current = 0
    setIsSpeaking(false)
  }, [])

  // Switching voice output off mid-sentence must go quiet at once.
  useEffect(() => {
    if (!enabled) stop()
  }, [enabled, stop])

  return { speak, stop, isSpeaking, isOutputAudible, error, clearError: () => setError(null) }
}
