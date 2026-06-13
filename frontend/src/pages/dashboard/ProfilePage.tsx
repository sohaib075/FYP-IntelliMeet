import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react"
import { useToastStore } from "@/store/useToastStore"
import { useAuthStore, mapBackendUser } from "@/store/useAuthStore"
import { userApi, ApiError } from "@/lib/api"
import { useNavigate } from "react-router-dom"

export function ProfilePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const addToast = useToastStore((state) => state.addToast)
  const { user, updatePreferences, updateProfile, logout } = useAuthStore()
  const navigate = useNavigate()

  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    sourceLanguage: user?.preferences?.sourceLanguage || "en",
    targetLanguage: user?.preferences?.targetLanguage || "zh",
  })

  const [password, setPassword] = useState({
    current: "",
    new: "",
    confirm: "",
  })

  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  })

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      // Update profile via backend API
      const data = await userApi.updateProfile({
        fullName: profile.name,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
        sourceLanguage: profile.sourceLanguage,
        targetLanguage: profile.targetLanguage,
      })
      // Sync local store with the backend response
      const mapped = mapBackendUser(data.user)
      updateProfile(mapped)
      addToast({ message: "Profile & Preferences updated successfully", variant: "success" })
    } catch (err) {
      if (err instanceof ApiError) {
        addToast({ message: err.message, variant: "error" })
      } else {
        addToast({ message: "Failed to save. Please try again.", variant: "error" })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.new !== password.confirm) {
      addToast({ message: "Passwords do not match", variant: "error" })
      return
    }
    
    setIsLoading(true)
    try {
      await userApi.updatePassword({
        currentPassword: password.current,
        newPassword: password.new
      })
      setPassword({ current: "", new: "", confirm: "" })
      addToast({ message: "Password updated successfully", variant: "success" })
    } catch (err) {
      if (err instanceof ApiError) {
        addToast({ message: err.message, variant: "error" })
      } else {
        addToast({ message: "Failed to update password. Please try again.", variant: "error" })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
      return
    }

    setIsDeleting(true)
    try {
      await userApi.deleteAccount()
      logout()
      addToast({ message: "Your account has been deleted.", variant: "success" })
      navigate("/login")
    } catch (err) {
      if (err instanceof ApiError) {
        addToast({ message: err.message, variant: "error" })
      } else {
        addToast({ message: "Failed to delete account. Please try again.", variant: "error" })
      }
      setIsDeleting(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-8">
      <h1 className="text-3xl font-bold font-display tracking-tight">Profile</h1>

      {/* Profile Header */}
      <Card className="bg-gradient-to-br from-[#F8FAFC] to-[#FFFFFF] border-[#E2E8F0]">
        <CardContent className="flex flex-col sm:flex-row items-center gap-6 p-8">
          <div className="h-24 w-24 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center text-3xl font-bold uppercase">
            {profile.name.substring(0, 2)}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold font-display text-[#0F172A]">{profile.name}</h2>
            <p className="text-[#64748B] mt-1">{profile.email}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
              <span className="text-[12px] text-[#3B82F6] bg-[#EFF6FF] px-2 py-0.5 rounded-full font-medium">
                Member
              </span>
            </div>
          </div>
          <div className="ml-auto mt-4 sm:mt-0">
            <Button className="bg-[#3B82F6] text-white hover:bg-[#2563EB]">Change Avatar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal details.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Input
                label="Full Name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                required
              />
              <Input
                label="Phone Number"
                type="tel"
                value={profile.phoneNumber}
                onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
              <div className="pt-6 mt-6 border-t border-[#E2E8F0]">
                <h4 className="text-[14px] font-semibold text-[#0F172A] mb-4">Language Preferences</h4>
                <p className="text-[13px] text-[#64748B] mb-4">These languages will be auto-selected when you join a meeting.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#0F172A] tracking-[0.2px] mb-1.5">Source Language (I speak)</label>
                    <Select value={profile.sourceLanguage} onValueChange={(v) => setProfile({ ...profile, sourceLanguage: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                        <SelectItem value="ur">🇵🇰 Urdu</SelectItem>
                        <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#0F172A] tracking-[0.2px] mb-1.5">Target Language (I want to hear)</label>
                    <Select value={profile.targetLanguage} onValueChange={(v) => setProfile({ ...profile, targetLanguage: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                        <SelectItem value="ur">🇵🇰 Urdu</SelectItem>
                        <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button type="submit" isLoading={isLoading} className="mt-6 bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0">
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Update your password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePassword} className="space-y-4">
                <Input
                  label="Current Password"
                  type={showPassword.current ? "text" : "password"}
                  value={password.current}
                  onChange={(e) => setPassword({ ...password, current: e.target.value })}
                  rightIcon={
                    <button 
                      type="button" 
                      onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })}
                      className="hover:text-[#0F172A] focus:outline-none flex items-center justify-center h-full"
                      aria-label={showPassword.current ? "Hide password" : "Show password"}
                    >
                      {showPassword.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <Input
                  label="New Password"
                  type={showPassword.new ? "text" : "password"}
                  value={password.new}
                  onChange={(e) => setPassword({ ...password, new: e.target.value })}
                  rightIcon={
                    <button 
                      type="button" 
                      onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                      className="hover:text-[#0F172A] focus:outline-none flex items-center justify-center h-full"
                      aria-label={showPassword.new ? "Hide password" : "Show password"}
                    >
                      {showPassword.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <Input
                  label="Confirm New Password"
                  type={showPassword.confirm ? "text" : "password"}
                  value={password.confirm}
                  onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                  rightIcon={
                    <button 
                      type="button" 
                      onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                      className="hover:text-[#0F172A] focus:outline-none flex items-center justify-center h-full"
                      aria-label={showPassword.confirm ? "Hide password" : "Show password"}
                    >
                      {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <Button type="submit" isLoading={isLoading} className="mt-4 bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0] border-0">
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[14px] text-red-600/80 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <Button 
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="bg-red-600 text-white hover:bg-red-700 border-0"
              >
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
