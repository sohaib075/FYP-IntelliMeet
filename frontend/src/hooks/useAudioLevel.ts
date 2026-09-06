import { useEffect, useRef, useState } from 'react'

/**
 * Measures how loudly the given stream's microphone is picking up, as a
 * number from 0 to 1.
 *
 * This replaces the placeholder that animated random bar heights: it reads
 * the real signal, so the meter only moves when you actually speak, which is
 * what makes it useful for checking the right microphone is selected.
 */
export function useAudioLevel(stream: MediaStream | null, active = true): number {
  const [level, setLevel] = useState(0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const track = stream?.getAudioTracks()[0]
    if (!active || !track) {
      setLevel(0)
      return
    }

    const AudioCtx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    let context: AudioContext
    let source: MediaStreamAudioSourceNode
    let analyser: AnalyserNode
    try {
      context = new AudioCtx()
      // Feed the analyser from a stream containing only this audio track, so a
      // video track in the same stream cannot upset the graph.
      source = context.createMediaStreamSource(new MediaStream([track]))
      analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
    } catch {
      return
    }

    const samples = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteTimeDomainData(samples)
      // Root mean square around the 128 midpoint gives a stable loudness
      // reading, unlike peak sampling which flickers.
      let sum = 0
      for (let i = 0; i < samples.length; i += 1) {
        const deviation = (samples[i] - 128) / 128
        sum += deviation * deviation
      }
      const rms = Math.sqrt(sum / samples.length)
      // Speech sits low in this range, so scale up and clamp for a meter that
      // actually moves at normal talking volume.
      setLevel(Math.min(1, rms * 4))
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      source.disconnect()
      analyser.disconnect()
      context.close().catch(() => {})
      setLevel(0)
    }
  }, [stream, active])

  return level
}
