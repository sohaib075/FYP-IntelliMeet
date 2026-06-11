import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "host" | "admin" | "active" | "language" | "error"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses = {
    default: "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border-transparent",
    host: "bg-[#F97316]/10 dark:bg-[#F97316]/20 text-[#F97316] border-[#F97316]/30",
    admin: "bg-[#EF4444]/10 dark:bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30",
    active: "bg-[#10B981]/10 dark:bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30",
    language: "bg-[#3B82F6]/10 dark:bg-[#3B82F6]/20 text-[#3B82F6] dark:text-[#93C5FD] border-[#3B82F6]/30",
    error: "bg-[#EF4444]/10 dark:bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
