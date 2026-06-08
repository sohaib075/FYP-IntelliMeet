import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar } from "./Avatar"

export interface ChatMessageProps {
  message: string
  senderName: string
  timestamp: string
  isSelf?: boolean
  showAvatar?: boolean
}

export function ChatMessage({
  message,
  senderName,
  timestamp,
  isSelf,
  showAvatar = true,
}: ChatMessageProps) {
  return (
    <div className={cn("flex w-full gap-3", isSelf ? "flex-row-reverse" : "flex-row")}>
      {showAvatar ? (
        <Avatar fallback={senderName} size="sm" className="mt-1" />
      ) : (
        <div className="w-8 shrink-0" /> // Spacer for alignment
      )}
      <div
        className={cn(
          "flex max-w-[80%] flex-col",
          isSelf ? "items-end" : "items-start"
        )}
      >
        {showAvatar && (
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-xs font-medium text-gray-300">
              {isSelf ? "You" : senderName}
            </span>
            <span className="text-[10px] text-gray-500">{timestamp}</span>
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2 text-sm",
            isSelf
              ? "rounded-tr-sm bg-[#3B82F6] text-white"
              : "rounded-tl-sm bg-[#1E2847] text-gray-100"
          )}
        >
          {message}
        </div>
      </div>
    </div>
  )
}
