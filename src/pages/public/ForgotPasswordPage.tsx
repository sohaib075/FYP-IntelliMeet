import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import { Logo } from "@/components/common/Logo"

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setIsSuccess(true)
    }, 1500)
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-4 w-full min-h-screen bg-[#F8FAFC] dark:bg-[#0A0E1A]">
      <Link to="/" className="mb-6 flex justify-center">
        <Logo size={42} className="text-[#0F172A] dark:text-white" />
      </Link>
      <div className="w-full max-w-md rounded-[16px] border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#161D35] p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h2 className="text-[28px] font-bold text-[#0F172A] dark:text-white font-display tracking-tight">Reset Password</h2>
          <p className="mt-2 text-[15px] text-[#64748B] dark:text-[#94A3B8]">
            {isSuccess ? "Check your inbox" : "Enter the email associated with your account and we'll send a reset link"}
          </p>
        </div>

        {isSuccess ? (
          <div className="flex flex-col items-center">
            <CheckCircle2 className="h-16 w-16 text-[#10B981] mb-6" />
            <p className="text-center text-[#0F172A] dark:text-white mb-8">
              We have sent a password reset link to <br/> <span className="font-medium">{email}</span>
            </p>
            <Button className="w-full" asChild>
              <Link to="/login">Return to Sign In</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              icon={<Mail className="h-4 w-4" />}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
            
            <Button type="submit" className="w-full mt-6" isLoading={isLoading}>
              Send Reset Link
            </Button>
          </form>
        )}

        {!isSuccess && (
          <div className="mt-6 flex justify-center text-[14px]">
            <Link to="/login" className="flex items-center text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
