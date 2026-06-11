import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "secondary" | "danger" | "ghost" | "icon"
  size?: "default" | "sm" | "lg" | "icon"
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Classes mapping based on prompt specs
    const variantClasses = {
      default: "bg-[#3B82F6] text-white hover:bg-[#2563EB] hover:scale-[1.02] shadow-sm hover:shadow-md focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2",
      secondary: "bg-transparent border border-[#3B82F6] text-[#3B82F6] hover:bg-[#3B82F6]/10 hover:scale-[1.02] shadow-sm hover:shadow-md focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2",
      danger: "bg-[#EF4444] text-white hover:bg-red-600 hover:scale-[1.02] shadow-sm hover:shadow-md focus:ring-2 focus:ring-[#EF4444] focus:ring-offset-2",
      ghost: "bg-transparent text-current hover:bg-[#1E2847] hover:text-white dark:hover:bg-[#1E2847] hover:bg-gray-100",
      icon: "bg-transparent text-current hover:bg-[#1E2847] hover:text-white dark:hover:bg-[#1E2847] hover:bg-gray-100"
    }

    const sizeClasses = {
      default: "h-10 px-4",
      sm: "h-8 px-3 text-xs",
      lg: "h-12 px-8 text-lg",
      icon: "h-10 w-10 p-0 rounded-full"
    }

    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-[6px] text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {asChild ? children : (
          <>
            {isLoading && (
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            )}
            {children}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button }
