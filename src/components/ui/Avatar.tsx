import * as React from "react"
import { cn } from "@/lib/utils"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback: string
  size?: "sm" | "md" | "lg" | "xl"
  isOnline?: boolean
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = "md", isOnline, ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8 text-xs",
      md: "h-10 w-10 text-sm",
      lg: "h-16 w-16 text-lg",
      xl: "h-24 w-24 text-2xl"
    }

    return (
      <div className="relative inline-block" ref={ref} {...props}>
        <div
          className={cn(
            "relative flex shrink-0 overflow-hidden rounded-full bg-[#F1F5F9] dark:bg-[#1E2847] border border-[#E2E8F0] dark:border-[#1E3A5F]",
            sizeClasses[size],
            className
          )}
        >
          {src ? (
            <img
              src={src}
              alt={alt || "Avatar"}
              className="aspect-square h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-medium text-[#0F172A] dark:text-white">
              {fallback.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        {isOnline !== undefined && (
          <span
            className={cn(
              "absolute bottom-0 right-0 block rounded-full ring-2 ring-white dark:ring-[#0A0E1A]",
              isOnline ? "bg-[#10B981]" : "bg-[#94A3B8]",
              size === "sm" ? "h-2 w-2" : size === "md" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"
            )}
          />
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

export { Avatar }
