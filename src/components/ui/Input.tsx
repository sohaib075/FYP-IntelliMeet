import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  icon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, icon, rightIcon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
              {icon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "flex h-10 w-full rounded-[6px] border bg-white dark:bg-[#1E2847] px-4 py-2 text-sm text-[#0F172A] dark:text-[#F1F5F9] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6] disabled:cursor-not-allowed disabled:opacity-50 transition-all",
              icon && "pl-10",
              rightIcon && "pr-10",
              error ? "border-[#EF4444] focus:ring-[#EF4444]" : "border-[#E2E8F0] dark:border-[#1E3A5F]",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-[#EF4444]">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-xs text-[#475569]">{helperText}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
