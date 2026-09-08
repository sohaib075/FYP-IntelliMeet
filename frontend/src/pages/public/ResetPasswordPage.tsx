import { useState, useEffect } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Lock } from "lucide-react"
import { useToastStore } from "@/store/useToastStore"
import { Logo } from "@/components/common/Logo"
import { authApi, ApiError } from "@/lib/api"

export function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")
  
  const navigate = useNavigate()
  const addToast = useToastStore((state) => state.addToast)

  useEffect(() => {
    if (!token) {
      addToast({ message: "Invalid or expired token. Please request a new link.", variant: "error" })
      navigate("/forgot-password")
    }
  }, [token, navigate, addToast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    
    try {
      await authApi.resetPassword(password, token as string)
      addToast({ message: "Password reset successful! Please log in.", variant: "success" })
      navigate("/login")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError("Unable to reset password. The link may be expired.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 8 ? 2 : 3
  const strengthColors = ["bg-gray-700", "bg-red-500", "bg-yellow-500", "bg-green-500"]

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-4 w-full min-h-screen bg-[#F8FAFC] dark:bg-[#0A0E1A]">
      <Link to="/" className="mb-6 flex justify-center">
        <Logo size={42} className="text-[#0F172A] dark:text-white" />
      </Link>
      <div className="w-full max-w-md rounded-[16px] border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#161D35] p-6 sm:p-8 shadow-xl">
        <div className="mb-6 sm:mb-8 text-center">
          <h2 className="text-[24px] sm:text-[28px] font-bold text-[#0F172A] dark:text-white font-display tracking-tight">Create New Password</h2>
          <p className="mt-2 text-[14px] sm:text-[15px] text-[#64748B] dark:text-[#94A3B8]">Please enter your new password below</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-3 text-sm text-[#EF4444] break-words">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              label="New Password"
              type="password"
              icon={<Lock className="h-4 w-4" />}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
            {password && (
              <div className="mt-2 flex gap-1 h-1.5 w-full">
                {[1, 2, 3].map((level) => (
                  <div key={level} className={`flex-1 rounded-full ${level <= passwordStrength ? strengthColors[passwordStrength] : "bg-[#E2E8F0] dark:bg-[#1E2847]"}`} />
                ))}
              </div>
            )}
          </div>

          <Input
            label="Confirm New Password"
            type="password"
            icon={<Lock className="h-4 w-4" />}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            required
          />

          <Button type="submit" className="w-full mt-6" isLoading={isLoading}>
            Reset Password
          </Button>
        </form>
      </div>
    </div>
  )
}
