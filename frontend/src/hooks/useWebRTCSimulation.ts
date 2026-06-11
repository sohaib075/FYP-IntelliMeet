import { useEffect, useRef } from 'react'
import { useMeetingStore } from '@/store/useMeetingStore'

/**
 * Simulates WebRTC signaling flow (offer/answer/ICE) via console logs
 * and the store's signalingLog array. Purely cosmetic.
 */
export function useWebRTCSimulation() {
  const { status, participants, logSignaling } = useMeetingStore()
  const hasRun = useRef(false)

  // Run the initial signaling sequence once when meeting becomes active
  useEffect(() => {
    if (status !== 'active' || hasRun.current) return
    hasRun.current = true

    const steps = [
      { delay: 300, msg: '[WebRTC] Initializing RTCPeerConnection...' },
      { delay: 800, msg: '[WebRTC] Creating local SDP offer...' },
      { delay: 1400, msg: '[WebRTC] Local offer SDP created: type=offer, sdp=v=0\\no=- 4611731400430051336 2 IN IP4 127.0.0.1...' },
      { delay: 2000, msg: '[WebRTC] Sending offer to signaling server (simulated)...' },
      { delay: 2800, msg: '[WebRTC] ICE candidate gathered: candidate:1 1 UDP 2130706431 192.168.1.5 54321 typ host' },
      { delay: 3200, msg: '[WebRTC] ICE candidate gathered: candidate:2 1 TCP 1694498815 192.168.1.5 9 typ host tcptype active' },
      { delay: 4000, msg: '[WebRTC] Received remote answer SDP: type=answer, sdp=v=0\\no=- 7891234567890 2 IN IP4 10.0.0.1...' },
      { delay: 4500, msg: '[WebRTC] Setting remote description...' },
      { delay: 5200, msg: '[WebRTC] ICE connection state: checking' },
      { delay: 6000, msg: '[WebRTC] ICE connection state: connected' },
      { delay: 6500, msg: '[WebRTC] DTLS handshake complete. SRTP keys exchanged.' },
      { delay: 7000, msg: '[WebRTC] Peer connection established successfully ✓' },
    ]

    const timers: ReturnType<typeof setTimeout>[] = []

    steps.forEach(({ delay, msg }) => {
      const t = setTimeout(() => {
        logSignaling(msg)
        console.log(`%c${msg}`, 'color: #06B6D4; font-family: monospace;')
      }, delay)
      timers.push(t)
    })

    return () => timers.forEach(clearTimeout)
  }, [status, logSignaling])

  // Log signaling events when new participants join
  useEffect(() => {
    if (status !== 'active') return
    const nonLocal = participants.filter((p) => p.id !== 'local-user')
    if (nonLocal.length === 0) return

    const latest = nonLocal[nonLocal.length - 1]
    const msgs = [
      `[WebRTC] New peer detected: ${latest.name}`,
      `[WebRTC] Creating offer for peer ${latest.id.substring(0, 8)}...`,
      `[WebRTC] ICE candidate for ${latest.name}: candidate:${Math.floor(Math.random() * 9) + 1} 1 UDP ${Math.floor(Math.random() * 2000000000)} ${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)} ${Math.floor(Math.random() * 65535)} typ srflx`,
      `[WebRTC] Peer connection established with ${latest.name} ✓`,
    ]

    msgs.forEach((msg, i) => {
      setTimeout(() => {
        logSignaling(msg)
        console.log(`%c${msg}`, 'color: #06B6D4; font-family: monospace;')
      }, (i + 1) * 400)
    })
  }, [participants.length, status, logSignaling, participants])
}
