import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff, ArrowLeftRight } from "lucide-react"
import { useState } from "react"
import { useAuthStore } from "@/store/useAuthStore"

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const validateForm = () => {
    let isValid = true
    setEmailError("")
    setPasswordError("")

    if (!email) {
      setEmailError("Email is required")
      isValid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address")
      isValid = false
    }

    if (!password) {
      setPasswordError("Password is required")
      isValid = false
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      isValid = false
    }

    return isValid
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setError("")
    setIsLoading(true)

    // Simulate API Call
    setTimeout(() => {
      if (email === "admin@example.com") {
        login("mock-jwt-token-admin", { 
          id: "1", name: "System Admin", email, role: "ADMIN",
          preferences: { sourceLanguage: "en", targetLanguage: "en" }
        })
        navigate('/admin')
      } else {
        login("mock-jwt-token-user", { 
          id: "2", name: "Muhammad Usman", email, role: "USER",
          preferences: { sourceLanguage: "ur", targetLanguage: "zh" }
        })
        navigate('/dashboard')
      }
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="flex min-h-screen w-full bg-white font-body text-[#0F172A]">
      
      {/* Left Column (Form) */}
      <div className="flex-1 flex flex-col px-6 py-8 md:px-12 lg:px-24">
        <Link to="/" className="text-[20px] font-bold font-display tracking-tight text-[#0F172A] mb-auto">
          IntelliMeet
        </Link>
        
        <div className="flex-1 flex flex-col justify-center max-w-[360px] w-full mx-auto">
          <h1 className="text-[28px] font-semibold text-[#0F172A] font-display mb-2">Welcome back</h1>
          <p className="text-[15px] text-[#64748B] mb-8">Sign in to your account to continue</p>
          
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <Input 
                type="email"
                label="Email address"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); setError("") }}
                placeholder="you@example.com"
                error={emailError}
                disabled={isLoading}
              />
              
              <Input 
                type={showPassword ? "text" : "password"}
                label="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(""); setError("") }}
                placeholder="••••••••"
                error={passwordError}
                disabled={isLoading}
                rightIcon={
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-[#0F172A] focus:outline-none flex items-center justify-center h-full"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>

            <div className="flex items-center justify-between pt-1 pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-[#E2E8F0] text-[#3B82F6] focus:ring-[#3B82F6]/20" />
                <span className="text-[13px] text-[#64748B]">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-[13px] text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-10"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[13px] text-[#94A3B8]">or</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          <div className="text-center text-[14px] text-[#64748B]">
            Don't have an account?{" "}
            <Link to="/register" className="text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors">
              Create one
            </Link>
          </div>
        </div>
        
        <div className="mt-auto" />
      </div>

      {/* Right Column (Visual) */}
      <div className="hidden lg:flex flex-1 bg-[#F8FAFC] border-l border-[#E2E8F0] items-center justify-center p-12 relative overflow-hidden">
        
        {/* Subtle Background Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-[#EFF6FF] to-[#E0F2FE] rounded-full blur-[100px] opacity-60" />

        <div className="relative z-10 flex flex-col items-center max-w-md">
          
          {/* Abstract Visual */}
          <div className="flex items-center gap-6 mb-12">
            <div className="h-20 w-24 bg-white border border-[#E2E8F0] rounded-2xl rounded-tr-sm shadow-sm flex items-center justify-center">
              <span className="text-3xl text-[#3B82F6] font-bold">اردو</span>
            </div>
            
            <div className="flex flex-col items-center justify-center gap-1 text-[#94A3B8]">
              <ArrowLeftRight className="h-6 w-6 text-[#3B82F6]" />
            </div>

            <div className="h-20 w-24 bg-[#0F172A] border border-[#1E293B] rounded-2xl rounded-tl-sm shadow-xl flex items-center justify-center">
              <span className="text-3xl text-white font-bold">中文</span>
            </div>
          </div>

          <p className="text-[16px] text-[#64748B] italic text-center leading-relaxed mb-10">
            "Connecting teams across languages, in real time."
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="bg-[#E2E8F0] text-[#64748B] px-3 py-1.5 rounded-full text-[13px] font-medium border border-[#CBD5E1]">🇵🇰 Urdu</span>
            <span className="bg-[#E2E8F0] text-[#64748B] px-3 py-1.5 rounded-full text-[13px] font-medium border border-[#CBD5E1]">🇨🇳 Chinese</span>
            <span className="bg-[#E2E8F0] text-[#64748B] px-3 py-1.5 rounded-full text-[13px] font-medium border border-[#CBD5E1]">🇬🇧 English</span>
          </div>

        </div>
      </div>

    </div>
  )
}
