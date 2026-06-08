import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar } from "./Avatar"
import { MicOff, VideoOff } from "lucide-react"

export interface VideoTileProps {
  name: string
  isHost?: boolean
  isSelf?: boolean
  isSpeaking?: boolean
  isMuted?: boolean
  cameraOff?: boolean
  language?: string
  isTranslating?: boolean
  videoStream?: MediaStream | null
  className?: string
}

export function VideoTile({
  name,
  isHost,
  isSelf,
  isSpeaking,
  isMuted,
  cameraOff,
  language,
  isTranslating,
  videoStream,
  className,
}: VideoTileProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream
    }
  }, [videoStream])

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[10px] bg-[#0A0E1A] transition-all",
        isSpeaking && "ring-2 ring-[#3B82F6]",
        isHost && "ring-1 ring-orange-500",
        className
      )}
    >
      {cameraOff ? (
        <Avatar fallback={name} size="xl" className="opacity-80" />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf} // always mute self to prevent echo
          className="h-full w-full object-cover"
        />
      )}

      {/* Overlays */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
          {isMuted && <MicOff className="h-3.5 w-3.5 text-red-400" />}
          <span className="max-w-[120px] truncate text-xs font-medium text-white">
            {name} {isSelf && "(You)"}
          </span>
          {isHost && (
            <span className="rounded bg-orange-500/20 px-1 py-0.5 text-[10px] font-bold text-orange-400">
              HOST
            </span>
          )}
        </div>
      </div>

      {/* Translation Indicator */}
      {isTranslating && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-2.5 py-1 text-xs font-medium text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-500/50 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
          </span>
          Translating
        </div>
      )}

      {/* Language Flag */}
      {language && (
        <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs backdrop-blur-sm text-gray-300">
          {language}
        </div>
      )}
    </div>
  )
}
