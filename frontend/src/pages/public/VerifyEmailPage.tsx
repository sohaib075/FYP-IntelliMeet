import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ShieldCheck, Mail, ArrowRight, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { authApi, ApiError } from "@/lib/api"
import { useAuthStore, mapBackendUser } from "@/store/useAuthStore"
import { useToastStore } from "@/store/useToastStore"
import { usePostLoginRedirect } from "@/components/auth/usePostLoginRedirect"

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get("email") || ""
  const navigate = useNavigate()
  const redirectAfterLogin = usePostLoginRedirect()
  const addToast = useToastStore((state) => state.addToast)
  const login = useAuthStore((state) => state.login)

  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const [error, setError] = useState("")

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!email) {
      navigate("/register")
    }
  }, [email, navigate])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [resendTimer])

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return

    const newOtp = [...otp]
    newOtp[index] = value.substring(value.length - 1)
    setOtp(newOtp)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text/plain").slice(0, 6).split("")
    const newOtp = [...otp]
    pastedData.forEach((char, i) => {
      if (!isNaN(Number(char)) && i < 6) {
        newOtp[i] = char
      }
    })
    setOtp(newOtp)
    if (pastedData.length >= 6) {
      inputRefs.current[5]?.focus()
    } else {
      inputRefs.current[pastedData.length]?.focus()
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join("")
    if (code.length !== 6) {
      setError("Please enter all 6 digits")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const data = await authApi.verifyOtp({ email, otp: code })
      const mappedUser = mapBackendUser(data.user)
      login(data.token, mappedUser)
      addToast({ message: "Email verified successfully!", variant: "success" })
      redirectAfterLogin()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError("Verification failed. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    setIsResending(true)
    setError("")

    try {
      await authApi.resendOtp(email)
      addToast({ message: "A new code has been sent to your email", variant: "success" })
      setResendTimer(60)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError("Failed to resend code. Please try again.")
      }
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-8 px-4 sm:py-12 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-[#EFF6FF] rounded-full flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-[#3B82F6]" />
          </div>
        </div>
        <h2 className="text-center text-2xl sm:text-3xl font-bold font-display text-[#0F172A] tracking-tight">
          Verify your email
        </h2>
        <p className="mt-3 text-center text-[14px] sm:text-[15px] text-[#64748B]">
          We sent a 6-digit verification code to
          <br />
          <span className="font-medium text-[#0F172A] break-all">{email}</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-6 px-4 shadow-sm border border-[#E2E8F0] rounded-2xl sm:py-8 sm:px-10">
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <div className="flex justify-between gap-1.5 sm:gap-2" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="flex-1 min-w-0 max-w-[48px] h-12 text-center text-xl font-bold font-display text-[#0F172A] border border-[#CBD5E1] rounded-lg bg-white shadow-sm focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all outline-none sm:flex-none sm:w-12 sm:h-14 sm:text-2xl"
                  />
                ))}
              </div>
              {error && <p className="mt-3 text-[13px] text-red-500 text-center font-medium">{error}</p>}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white py-6 text-[15px] shadow-sm group"
              isLoading={isLoading}
            >
              Verify Account
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </form>

          <div className="mt-6 sm:mt-8 text-center border-t border-[#E2E8F0] pt-6">
            <p className="text-[14px] text-[#64748B] mb-4">Didn't receive the code?</p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleResend}
              disabled={resendTimer > 0 || isResending}
              className="w-full text-[#3B82F6] border-[#E2E8F0] hover:bg-[#F8FAFC]"
            >
              {isResending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Code"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
