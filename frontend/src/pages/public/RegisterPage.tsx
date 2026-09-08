import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ArrowLeftRight, Eye, EyeOff } from "lucide-react"
import { useAuthStore, mapBackendUser } from "@/store/useAuthStore"
import { Logo } from "@/components/common/Logo"
import { authApi, ApiError } from "@/lib/api"
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton"
export function RegisterPage() {
  const navigate = useNavigate()
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

  const validateName = (val: string) => {
    if (!val.trim()) return "Full name is required.";
    if (val.trim().length < 2 || val.trim().length > 50) return "Full name must be between 2 and 50 characters.";
    if (!/^[a-zA-Z\s]+$/.test(val)) return "Full name can only contain letters and spaces.";
    return "";
  };

  const validateEmail = (val: string) => {
    if (!val.trim()) return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Please enter a valid email address.";
    return "";
  };

  const validatePassword = (val: string) => {
    if (!val) return "Password is required.";
    if (val.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(val)) return "Password must contain at least one uppercase letter.";
    if (!/[a-z]/.test(val)) return "Password must contain at least one lowercase letter.";
    if (!/\d/.test(val)) return "Password must contain at least one number.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(val)) return "Password must contain at least one special character.";
    return "";
  };

  const validateConfirmPassword = (val: string, pwd: string) => {
    if (!val) return "Please confirm your password.";
    if (val !== pwd) return "Passwords do not match.";
    return "";
  };

  const validateForm = () => {
    const errors = {
      name: validateName(formData.name),
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
      confirmPassword: validateConfirmPassword(formData.confirmPassword, formData.password)
    };

    setFieldErrors(errors);
    return !Object.values(errors).some(err => err !== "");
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");

    // Real-time validation if error implies user is correcting it
    setFieldErrors(prev => {
      if (!prev[field as keyof typeof prev]) return prev;

      let error = "";
      if (field === "name") error = validateName(value);
      if (field === "email") error = validateEmail(value);
      if (field === "password") error = validatePassword(value);
      if (field === "confirmPassword") error = validateConfirmPassword(value, formData.password);

      return { ...prev, [field]: error };
    });
  };

  const handleBlur = (field: string) => {
    setFieldErrors(prev => {
      let error = "";
      if (field === "name") error = validateName(formData.name);
      if (field === "email") error = validateEmail(formData.email);
      if (field === "password") error = validatePassword(formData.password);
      if (field === "confirmPassword") error = validateConfirmPassword(formData.confirmPassword, formData.password);

      return { ...prev, [field]: error };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setError("")
    setIsLoading(true)

    try {
      await authApi.register({
        fullName: formData.name,
        email: formData.email,
        password: formData.password,
      })
      // Do not log in yet, redirect to verification page
      navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`)
    } catch (err) {
      if (err instanceof ApiError) {
        // Map server-side field validation errors to form fields
        if (err.errors && err.errors.length > 0) {
          const newFieldErrors = { ...fieldErrors }
          err.errors.forEach((e) => {
            if (e.field === 'fullName') newFieldErrors.name = e.message
            else if (e.field === 'email') newFieldErrors.email = e.message
            else if (e.field === 'password') newFieldErrors.password = e.message
          })
          setFieldErrors(newFieldErrors)
        }
        setError(err.message)
      } else {
        setError('Unable to connect to server. Please try again later.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-[#F8FAFC] font-body text-[#0F172A] overflow-hidden">

      {/* Left Column (Form) */}
      <div className="flex-1 flex flex-col justify-between px-5 py-6 sm:px-6 sm:py-8 md:px-16 lg:px-20 bg-white relative z-10 shadow-2xl overflow-y-auto">
        <Link to="/" className="flex items-center mb-6 self-start hover:opacity-85 transition-opacity">
          <Logo size={42} className="text-[#3B82F6]" />
        </Link>

        <div className="my-auto max-w-[380px] w-full mx-auto space-y-5 sm:space-y-6">
          <div className="space-y-2">
            <h1 className="text-[26px] sm:text-[32px] font-bold text-[#0F172A] font-display tracking-tight leading-tight">Create Account</h1>
            <p className="text-[14px] sm:text-[15px] text-[#64748B]">Join IntelliMeet to start connecting intelligently</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3.5 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-start sm:items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5 sm:mt-0" />
                <span className="min-w-0 break-words">{error}</span>
              </div>
            )}

            <div className="space-y-3.5">
              <Input
                type="text"
                label="Full Name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                onBlur={() => handleBlur("name")}
                placeholder="John Doe"
                error={fieldErrors.name}
                disabled={isLoading}
                className="rounded-xl border-[#E2E8F0] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/10 transition-all h-10.5"
              />

              <Input
                type="email"
                label="Email address"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                placeholder="you@example.com"
                error={fieldErrors.email}
                disabled={isLoading}
                className="rounded-xl border-[#E2E8F0] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/10 transition-all h-10.5"
              />

              <Input
                type={showPassword ? "text" : "password"}
                label="Password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                placeholder="••••••••"
                error={fieldErrors.password}
                disabled={isLoading}
                className="rounded-xl border-[#E2E8F0] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/10 transition-all h-10.5"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#94A3B8] hover:text-[#0F172A] focus:outline-none flex items-center justify-center h-full pr-1.5"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                }
              />

              <Input
                type={showConfirmPassword ? "text" : "password"}
                label="Confirm Password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                onBlur={() => handleBlur("confirmPassword")}
                placeholder="••••••••"
                error={fieldErrors.confirmPassword}
                disabled={isLoading}
                className="rounded-xl border-[#E2E8F0] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/10 transition-all h-10.5"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-[#94A3B8] hover:text-[#0F172A] focus:outline-none flex items-center justify-center h-full pr-1.5"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                }
              />
            </div>

            <label className="flex items-start gap-2.5 pt-2 cursor-pointer group select-none">
              <input type="checkbox" required className="mt-1 w-4.5 h-4.5 rounded border-[#CBD5E1] text-[#3B82F6] focus:ring-[#3B82F6]/20 transition-all cursor-pointer" />
              <span className="text-[13px] text-[#64748B] leading-normal group-hover:text-[#0F172A] transition-colors">
                I agree to the <Link to="/terms" className="text-[#3B82F6] hover:text-[#2563EB] font-semibold">Terms & Conditions</Link> and <Link to="/privacy" className="text-[#3B82F6] hover:text-[#2563EB] font-semibold">Privacy Policy</Link>
              </span>
            </label>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.99] transition-all mt-2"
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[13px] text-[#94A3B8] font-medium uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          <GoogleAuthButton onError={(msg) => setError(msg)} />

          <div className="text-center text-[14px] text-[#64748B] mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-[#3B82F6] hover:text-[#2563EB] font-semibold transition-colors">
              Sign in
            </Link>
          </div>
        </div>

        <div className="text-center text-[12px] text-[#94A3B8] mt-6">
          © {new Date().getFullYear()} IntelliMeet. All rights reserved.
        </div>
      </div>

      {/* Right Column (Visual Showcase) */}
      <div className="hidden lg:flex flex-1 bg-[#090D1A] relative items-center justify-center p-12 overflow-hidden">

        {/* Cinematic Backdrop Glows */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(99,102,241,0.12),transparent_60%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#1E3A8A]/10 rounded-full blur-[140px]" />

        {/* Animated Cyber Grid background overlay */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative z-10 flex flex-col items-center max-w-lg w-full">

          {/* Simulated Real-time Translation Wave Interface */}
          <div className="w-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-6 shadow-2xl mb-8 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[12px] font-semibold text-white/90 font-display">Active AI Translation Session</span>
              </div>
              <span className="text-[11px] font-mono text-white/40">ID: intellimeet-room</span>
            </div>

            {/* Chat bubble 1 */}
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-[#3B82F6]/20 border border-[#3B82F6]/40 text-white flex items-center justify-center text-xs font-bold shrink-0">PK</div>
              <div className="space-y-1">
                <div className="bg-white/[0.04] border border-white/[0.06] text-white text-[13px] px-3.5 py-2 rounded-xl rounded-tl-sm max-w-[280px]">
                  السلام علیکم، کیا حال ہے؟
                </div>
                <div className="text-[11px] text-[#3B82F6] font-medium flex items-center gap-1.5">
                  <span>Urdu</span>
                  <span className="text-white/20">→</span>
                  <span className="bg-[#3B82F6]/10 px-1.5 py-0.5 rounded text-[10px]">English: "Hello, how are you?"</span>
                </div>
              </div>
            </div>

            {/* Chat bubble 2 */}
            <div className="flex gap-3 flex-row-reverse">
              <div className="h-8 w-8 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-white flex items-center justify-center text-xs font-bold shrink-0">CN</div>
              <div className="space-y-1 flex flex-col items-end">
                <div className="bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 text-white text-[13px] px-3.5 py-2 rounded-xl rounded-tr-sm max-w-[280px]">
                  我做得很好。 项目进展如何？
                </div>
                <div className="text-[11px] text-[#A78BFA] font-medium flex items-center gap-1.5">
                  <span className="bg-[#8B5CF6]/10 px-1.5 py-0.5 rounded text-[10px]">Urdu: "میں ٹھیک ہوں، پروجیکٹ کیسا چل رہا ہے؟"</span>
                  <span className="text-white/20">←</span>
                  <span>Chinese</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center space-y-3">
            <h2 className="text-2xl font-bold font-display text-white tracking-tight">
              Break Language Barriers in Real-Time
            </h2>
            <p className="text-[15px] text-[#94A3B8] leading-relaxed max-w-sm mx-auto">
              Collaborate globally with Urdu, English, and Chinese instant translation and transcription services.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
