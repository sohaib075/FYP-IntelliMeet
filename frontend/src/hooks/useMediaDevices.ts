import { useCallback, useEffect, useState } from 'react'

export type DeviceKind = 'videoinput' | 'audioinput' | 'audiooutput'

export interface SelectedDevices {
  videoinput?: string
  audioinput?: string
  audiooutput?: string
}

const STORAGE_KEY = 'intellimeet-devices'

/** Remembered device choices, so people pick their headset once. */
function loadSelection(): SelectedDevices {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SelectedDevices) : {}
  } catch {
    return {}
  }
}

/**
 * Read the remembered devices outside React, for code that publishes tracks
 * (the meeting room) rather than rendering pickers.
 */
export function getStoredDevices(): SelectedDevices {
  return loadSelection()
}

function saveSelection(next: SelectedDevices): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private mode - the choice just won't persist */
  }
}

/**
 * Enumerates cameras, microphones and speakers, and remembers which ones the
 * person picked.
 *
 * Browsers hide device labels until the page has been granted media access,
 * so this re-enumerates whenever permission changes. It also listens for
 * `devicechange`, which fires when a headset is plugged in or pulled out.
 */
export function useMediaDevices(enabled = true) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selected, setSelected] = useState<SelectedDevices>(loadSelection)
  const [supported] = useState(
    () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.enumerateDevices
  )

  const refresh = useCallback(async () => {
    if (!supported) return
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices(list)
    } catch {
      setDevices([])
    }
  }, [supported])

  useEffect(() => {
    if (!enabled || !supported) return
    refresh()
    const onChange = () => refresh()
    navigator.mediaDevices.addEventListener('devicechange', onChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange)
  }, [enabled, supported, refresh])

  const select = useCallback((kind: DeviceKind, deviceId: string) => {
    setSelected((prev) => {
      const next = { ...prev, [kind]: deviceId }
      saveSelection(next)
      return next
    })
  }, [])

  const byKind = (kind: DeviceKind) =>
    devices.filter((d) => d.kind === kind && d.deviceId && d.deviceId !== 'default')

  const cameras = byKind('videoinput')
  const microphones = byKind('audioinput')
  const speakers = byKind('audiooutput')

  /**
   * A remembered device can disappear (headset unplugged). Fall back to the
   * first available one rather than asking for a deviceId that no longer exists,
   * which would make getUserMedia throw OverconstrainedError.
   */
  const resolve = (kind: DeviceKind, available: MediaDeviceInfo[]): string | undefined => {
    const wanted = selected[kind]
    if (wanted && available.some((d) => d.deviceId === wanted)) return wanted
    return available[0]?.deviceId
  }

  return {
    supported,
    devices,
    cameras,
    microphones,
    speakers,
    /** Labels are blank until the page has media permission. */
    hasLabels: devices.some((d) => d.label !== ''),
    selected,
    select,
    refresh,
    activeCameraId: resolve('videoinput', cameras),
    activeMicrophoneId: resolve('audioinput', microphones),
    activeSpeakerId: resolve('audiooutput', speakers),
  }
}
