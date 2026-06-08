import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { Eye, EyeOff } from "lucide-react"
import { useToastStore } from "@/store/useToastStore"
import { useAuthStore } from "@/store/useAuthStore"

export function ProfilePage() {
  const [isLoading, setIsLoading] = useState(false)
  const addToast = useToastStore((state) => state.addToast)
  const { user, updatePreferences, updateProfile } = useAuthStore()

  const [profile, setProfile] = useState({
    name: user?.name || "John Doe",
    email: user?.email || "john@example.com",
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

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      updateProfile(profile.name)
      updatePreferences({ sourceLanguage: profile.sourceLanguage, targetLanguage: profile.targetLanguage })
      setIsLoading(false)
      addToast({ message: "Profile & Preferences updated successfully", variant: "success" })
    }, 1000)
  }

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.new !== password.confirm) {
      addToast({ message: "Passwords do not match", variant: "error" })
      return
    }
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setPassword({ current: "", new: "", confirm: "" })
      addToast({ message: "Password updated successfully", variant: "success" })
    }, 1000)
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
                {user?.role === 'ADMIN' ? 'Admin' : 'Host'}
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
              />
              <Input
                label="Email Address"
                value={profile.email}
                disabled
                helperText="Email address cannot be changed."
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
              <Button className="bg-red-600 text-white hover:bg-red-700 border-0">Delete Account</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
