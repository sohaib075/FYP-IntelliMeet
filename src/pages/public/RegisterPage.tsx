import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ArrowLeftRight, Eye, EyeOff } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"

export function RegisterPage() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  })

  const validateForm = () => {
    let isValid = true
    const newErrors = { name: "", email: "", password: "", confirmPassword: "" }

    if (!formData.name.trim()) {
      newErrors.name = "Full name is required"
      isValid = false
    }

    if (!formData.email) {
      newErrors.email = "Email is required"
      isValid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
      isValid = false
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
      isValid = false
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
      isValid = false
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password"
      isValid = false
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
      isValid = false
    }

    setFieldErrors(newErrors)
    return isValid
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setError("")

    setIsLoading(true)

    // Simulate API Call
    setTimeout(() => {
      login("mock-jwt-token-newuser", { 
        id: "3", name: formData.name, email: formData.email, role: "USER",
        preferences: { sourceLanguage: "en", targetLanguage: "en" }
      })
      navigate('/dashboard')
      setIsLoading(false)
    }, 1500)
  }

  return (
    <div className="flex min-h-screen w-full bg-white font-body text-[#0F172A]">
      
      {/* Left Column (Visual) */}
      <div className="hidden lg:flex flex-1 bg-[#F8FAFC] border-r border-[#E2E8F0] items-center justify-center p-12 relative overflow-hidden order-2 lg:order-1">
        
        {/* Subtle Background Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#E0F2FE] to-[#EFF6FF] rounded-full blur-[100px] opacity-60" />

        <div className="relative z-10 flex flex-col items-center max-w-md">
          <div className="flex items-center gap-6 mb-12">
            <div className="h-20 w-24 bg-[#0F172A] border border-[#1E293B] rounded-2xl rounded-tr-sm shadow-xl flex items-center justify-center">
              <span className="text-3xl text-white font-bold">Hello</span>
            </div>
            
            <div className="flex flex-col items-center justify-center gap-1 text-[#94A3B8]">
              <ArrowLeftRight className="h-6 w-6 text-[#3B82F6]" />
            </div>

            <div className="h-20 w-24 bg-white border border-[#E2E8F0] rounded-2xl rounded-tl-sm shadow-sm flex items-center justify-center">
              <span className="text-3xl text-[#3B82F6] font-bold">Hola</span>
            </div>
          </div>

          <p className="text-[16px] text-[#64748B] italic text-center leading-relaxed mb-10">
            "Break down language barriers securely. Your conversations, translated and protected."
          </p>
        </div>
      </div>

      {/* Right Column (Form) */}
      <div className="flex-1 flex flex-col px-6 py-8 md:px-12 lg:px-24 order-1 lg:order-2">
        <Link to="/" className="text-[20px] font-bold font-display tracking-tight text-[#0F172A] mb-auto">
          IntelliMeet
        </Link>
        
        <div className="flex-1 flex flex-col justify-center max-w-[360px] w-full mx-auto">
          <h1 className="text-[28px] font-semibold text-[#0F172A] font-display mb-2">Create Account</h1>
          <p className="text-[15px] text-[#64748B] mb-8">Join IntelliMeet to start connecting</p>
          
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Input 
                type="text"
                label="Full Name"
                value={formData.name}
                onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFieldErrors({ ...fieldErrors, name: "" }) }}
                placeholder="John Doe"
                error={fieldErrors.name}
                disabled={isLoading}
              />
              
              <Input 
                type="email"
                label="Email address"
                value={formData.email}
                onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFieldErrors({ ...fieldErrors, email: "" }) }}
                placeholder="you@example.com"
                error={fieldErrors.email}
                disabled={isLoading}
              />
              
              <Input 
                type={showPassword ? "text" : "password"}
                label="Password"
                value={formData.password}
                onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setFieldErrors({ ...fieldErrors, password: "" }) }}
                placeholder="••••••••"
                error={fieldErrors.password}
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

              <Input 
                type={showConfirmPassword ? "text" : "password"}
                label="Confirm Password"
                value={formData.confirmPassword}
                onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); setFieldErrors({ ...fieldErrors, confirmPassword: "" }) }}
                placeholder="••••••••"
                error={fieldErrors.confirmPassword}
                disabled={isLoading}
                rightIcon={
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="hover:text-[#0F172A] focus:outline-none flex items-center justify-center h-full"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>

            <label className="flex items-start gap-2 pt-2 cursor-pointer">
              <input type="checkbox" required className="mt-1 w-4 h-4 rounded border-[#E2E8F0] text-[#3B82F6] focus:ring-[#3B82F6]/20" />
              <span className="text-[13px] text-[#64748B]">I agree to the <a href="#" className="text-[#3B82F6] hover:text-[#2563EB]">Terms & Conditions</a> and <a href="#" className="text-[#3B82F6] hover:text-[#2563EB]">Privacy Policy</a></span>
            </label>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-10 mt-2"
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[13px] text-[#94A3B8]">or</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          <div className="text-center text-[14px] text-[#64748B]">
            Already have an account?{" "}
            <Link to="/login" className="text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors">
              Sign in
            </Link>
          </div>
        </div>
        
        <div className="mt-auto" />
      </div>

    </div>
  )
}
