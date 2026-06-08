import * as React from "react"
import { Avatar } from "./Avatar"
import { Badge } from "./Badge"
import { Mic, MicOff, Video, VideoOff, XCircle } from "lucide-react"

export interface ParticipantListItemProps {
  name: string
  isHost?: boolean
  isSelf?: boolean
  language?: string
  isMuted?: boolean
  cameraOff?: boolean
  onMute?: () => void
  onRemove?: () => void
  canManage?: boolean
}

export function ParticipantListItem({
  name,
  isHost,
  isSelf,
  language,
  isMuted,
  cameraOff,
  onMute,
  onRemove,
  canManage,
}: ParticipantListItemProps) {
  return (
    <div className="flex items-center justify-between rounded-lg p-2 hover:bg-[#1E2847] transition-colors">
      <div className="flex items-center gap-3 overflow-hidden">
        <Avatar fallback={name} size="sm" />
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-200">
              {name} {isSelf && "(You)"}
            </span>
            {isHost && <Badge variant="host">HOST</Badge>}
          </div>
          {language && (
            <span className="text-xs text-gray-400">{language}</span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {/* Status Icons */}
        <div className="flex items-center gap-1.5 mr-2">
          {isMuted ? (
            <MicOff className="h-4 w-4 text-red-400" />
          ) : (
            <Mic className="h-4 w-4 text-gray-400" />
          )}
          {cameraOff ? (
            <VideoOff className="h-4 w-4 text-red-400" />
          ) : (
            <Video className="h-4 w-4 text-gray-400" />
          )}
        </div>

        {/* Host Actions */}
        {canManage && !isSelf && (
          <div className="flex items-center gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={onMute}
              className="p-1.5 rounded bg-[#1E3A5F] text-gray-300 hover:text-white hover:bg-[#3B82F6] transition-colors"
              title={`Mute ${name}`}
            >
              <MicOff className="h-4 w-4" />
            </button>
            <button
              onClick={onRemove}
              className="p-1.5 rounded bg-[#1E3A5F] text-red-400 hover:text-white hover:bg-red-500 transition-colors"
              title={`Remove ${name}`}
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
