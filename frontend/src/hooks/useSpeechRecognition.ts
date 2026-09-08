import { useEffect, useRef } from 'react'
import { loadSpeechSDK, createSpeechConfig, invalidateSpeechToken } from '@/lib/speechClient'
import { getLanguage } from '@/lib/languages'
import { describeApiError } from '@/lib/api'

/**
 * ============================================================
 * Real-time speech recognition on the EXISTING meeting microphone
 * ============================================================
 * Streams the local LiveKit microphone track to Azure and reports interim and
 * final results as the user speaks. There is no recording, no file, and no
 * upload — `AudioConfig.fromStreamInput` takes a live MediaStream.
 *
 * Why it reuses the LiveKit track instead of calling getUserMedia:
 *   A second capture would be a second device handle — a second permission
 *   surface, double CPU, and on some hardware an outright device conflict.
 *   Wrapping the already-published track in a fresh MediaStream is a
 *   read-only tap; LiveKit keeps publishing exactly as before. This is the
 *   same pattern the project already uses for the mic level meter
 *   (useAudioLevel.ts).
 *
 * Two LiveKit behaviours drive the lifecycle here:
 *   - Muting only sets `track.enabled = false` on the SAME track, so the
 *     recogniser stays attached and simply hears silence. Nothing to do.
 *   - Switching input device REPLACES the track. The caller passes the new
 *     track in, and the effect below rebuilds the recogniser around it.
 * ============================================================
 */

interface Options {
  /** Master switch. False tears everything down and releases the connection. */
  enabled: boolean
  /** App-level language code the speaker is talking in, e.g. 'en'. */
  languageCode: string
  /** Live microphone track from LiveKit, or null when unavailable. */
  micTrack: MediaStreamTrack | null
  /** Fired continuously as a sentence forms. Display only — never translate these. */
  onInterim: (text: string) => void
  /** Fired once per completed utterance. This is what gets translated. */
  onFinal: (text: string) => void
  /** Human-readable failure, suitable for showing in the panel. */
  onError: (message: string) => void
  /**
   * Consulted at the moment a result arrives. Return true to discard it —
   * used to drop anything recognised while our own TTS is audible, which is
   * what stops translated speech being re-recognised and translated again.
   */
  shouldDiscard?: () => boolean
}

export function useSpeechRecognition({
  enabled,
  languageCode,
  micTrack,
  onInterim,
  onFinal,
  onError,
  shouldDiscard,
}: Options): void {
  // Callbacks live in refs so that a parent re-render (which creates new
  // function identities every time) cannot tear down and rebuild the
  // recogniser — that would drop audio mid-sentence.
  const handlers = useRef({ onInterim, onFinal, onError, shouldDiscard })
  handlers.current = { onInterim, onFinal, onError, shouldDiscard }

  useEffect(() => {
    if (!enabled || !micTrack) return

    let disposed = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let recognizer: any = null

    const start = async () => {
      try {
        const sdk = await loadSpeechSDK()
        if (disposed) return

        const speechConfig = await createSpeechConfig(sdk)
        if (disposed) return

        speechConfig.speechRecognitionLanguage = getLanguage(languageCode).speech

        // A live tap on the published track. `new MediaStream([track])` does
        // not clone or consume the track, so LiveKit is unaffected.
        const audioConfig = sdk.AudioConfig.fromStreamInput(new MediaStream([micTrack]))
        recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)

        // Interim: the sentence so far. Cheap, frequent, display-only.
        recognizer.recognizing = (_s: unknown, e: { result: { text: string } }) => {
          if (disposed) return
          const text = e.result?.text?.trim()
          if (text) handlers.current.onInterim(text)
        }

        // Final: Azure decided the utterance ended (a pause, or end of speech).
        // This is the ONLY thing that reaches the translation API.
        recognizer.recognized = (
          _s: unknown,
          e: { result: { reason: number; text: string } }
        ) => {
          if (disposed) return
          if (e.result?.reason !== sdk.ResultReason.RecognizedSpeech) return

          const text = e.result.text?.trim()
          // NoMatch arrives as an empty string on silence — skip it rather
          // than paying for a translation of nothing.
          if (!text) return

          if (handlers.current.shouldDiscard?.()) {
            console.log('[AI] Discarded a result recognised during TTS playback')
            return
          }

          console.log(`[AI] Final transcript received (${text.length} chars)`)
          handlers.current.onFinal(text)
        }

        recognizer.canceled = (
          _s: unknown,
          e: { reason: number; errorCode: number; errorDetails?: string }
        ) => {
          if (disposed) return
          if (e.reason !== sdk.CancellationReason.Error) return

          console.error('[AI] Recognition canceled:', e.errorDetails)

          // An expired or rejected token is the one failure worth recovering
          // from automatically: drop it so the next start fetches a new one.
          if (e.errorCode === sdk.CancellationErrorCode.AuthenticationFailure) {
            invalidateSpeechToken()
          }
          handlers.current.onError('Speech recognition unavailable. Please try again.')
        }

        await new Promise<void>((resolve, reject) => {
          recognizer.startContinuousRecognitionAsync(resolve, reject)
        })

        if (disposed) return
        console.log(`[AI] Speech recognition started (${getLanguage(languageCode).speech})`)
      } catch (err) {
        if (disposed) return
        console.error('[AI] Failed to start recognition:', err)
        // describeApiError turns a 503 SPEECH_NOT_CONFIGURED into the real
        // reason instead of a generic failure.
        handlers.current.onError(describeApiError(err))
      }
    }

    void start()

    return () => {
      disposed = true
      if (!recognizer) return

      // Stop before close, or the SDK can log an error about closing an
      // active recogniser. Failures here are terminal-state noise: we are
      // tearing down regardless.
      try {
        recognizer.stopContinuousRecognitionAsync(
          () => {
            try {
              recognizer.close()
            } catch {
              /* already closed */
            }
            console.log('[AI] Speech recognition stopped')
          },
          () => {
            try {
              recognizer.close()
            } catch {
              /* already closed */
            }
          }
        )
      } catch {
        /* recogniser never fully started */
      }
    }
    // `micTrack` identity changes when LiveKit restarts the track on a device
    // switch, which is exactly when the recogniser must be rebuilt.
  }, [enabled, languageCode, micTrack])
}
