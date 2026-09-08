import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Switch } from "@/components/ui/Switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { useAuthStore } from "@/store/useAuthStore"
import { useToastStore } from "@/store/useToastStore"
import { Button } from "@/components/ui/Button"
import { userApi, describeApiError } from "@/lib/api"

export function SettingsPage() {
  const { user, updatePreferences, updateProfile } = useAuthStore()
  const addToast = useToastStore((state) => state.addToast)
  const [isSaving, setIsSaving] = useState(false)

  const [settings, setSettings] = useState({
    general: {
      displayName: user?.name || "",
      defaultView: "speaker",
      uiLanguage: "en",
    },
    av: {
      autoMute: true,
      autoVideoOff: false,
      noiseCancellation: true,
    },
    translation: {
      showSubtitles: true,
      translationAudio: true,
    },
    notifications: {
      emailInvites: true,
      inAppInvites: true,
      meetingReminders: true,
      postSummaryEmail: true,
    }
  })

  // Load settings on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("intellimeet-app-settings")
      if (stored) {
        const parsed = JSON.parse(stored)
        setSettings(prev => ({
          ...prev,
          ...parsed,
          general: {
            ...prev.general,
            ...parsed.general,
            displayName: user?.name || parsed.general?.displayName || prev.general.displayName
          }
        }))
      } else if (user) {
        setSettings(prev => ({
          ...prev,
          general: {
            ...prev.general,
            displayName: user.name
          }
        }))
      }
    } catch (e) {
      console.error("Failed to load settings", e)
    }
  }, [user])

  /**
   * Persist the settings.
   *
   * The display name goes to the SERVER, not just the local store. This used
   * to call the store's updateProfile() only, wrapped in a fake 800ms delay,
   * so the page reported "saved successfully" and the name reverted on the
   * next login. The remaining toggles are genuinely device-local preferences,
   * so localStorage is the right home for those.
   */
  const handleSave = async () => {
    setIsSaving(true)
    const name = settings.general.displayName.trim()

    try {
      if (name && name !== user?.name) {
        const { user: updated } = await userApi.updateProfile({ fullName: name })
        updateProfile({ name: updated.fullName })
      }

      localStorage.setItem("intellimeet-app-settings", JSON.stringify(settings))
      addToast({ message: "Settings saved.", variant: "success" })
    } catch (err) {
      // Say what actually failed instead of claiming success.
      addToast({ message: describeApiError(err), variant: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  const [activeTab, setActiveTab] = useState("general")
  const tabs = [
    { id: "general", label: "General" },
    { id: "av", label: "Audio & Video" },
    { id: "translation", label: "Language & Translation" },
    { id: "notifications", label: "Notifications" },
    { id: "privacy", label: "Privacy & Security" },
  ]

  return (
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 md:gap-8 p-4 md:p-0">
      <div className="w-full min-w-0 md:w-64 shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight mb-4 md:mb-6">Settings</h1>
        {/* The tab strip scrolls sideways on a phone instead of widening the
            page; it goes back to a vertical column from md: up. */}
        <div className="flex md:flex-col overflow-x-auto gap-2 md:gap-1 pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 min-h-[40px] md:min-h-0 whitespace-nowrap px-4 py-2 text-[14px] font-medium rounded-lg text-left transition-colors ${
                activeTab === tab.id
                  ? "bg-[#3B82F6] text-white shadow-sm"
                  : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-6">
        {activeTab === "general" && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure your general IntelliMeet experience.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
              <div>
                <label className="block text-[13px] font-medium text-[#0F172A] tracking-[0.2px] mb-1.5">Display Name</label>
                <input 
                  type="text" 
                  value={settings.general.displayName} 
                  onChange={(e) => setSettings(s => ({...s, general: {...s.general, displayName: e.target.value}}))}
                  className="w-full md:w-[300px] h-[38px] px-3 bg-white border border-[#E2E8F0] rounded-lg text-[14px] text-[#0F172A] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/10 transition-all font-body"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0F172A] tracking-[0.2px] mb-1.5">Default Meeting View</label>
                <Select 
                  value={settings.general.defaultView} 
                  onValueChange={(v) => setSettings(s => ({...s, general: {...s.general, defaultView: v}}))}
                >
                  <SelectTrigger className="w-full md:w-[300px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="speaker">Speaker View</SelectItem>
                    <SelectItem value="grid">Grid View</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0F172A] tracking-[0.2px] mb-1.5">UI Language</label>
                <Select 
                  value={settings.general.uiLanguage} 
                  onValueChange={(v) => setSettings(s => ({...s, general: {...s.general, uiLanguage: v}}))}
                >
                  <SelectTrigger className="w-full md:w-[300px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ur">Urdu (اردو)</SelectItem>
                    <SelectItem value="zh">Chinese (中文)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end pt-4 border-t border-[#E2E8F0]">
                <Button
                  onClick={handleSave}
                  isLoading={isSaving}
                  className="w-full sm:w-auto bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0"
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "av" && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Audio & Video</CardTitle>
              <CardDescription>Manage your default devices and meeting entry behavior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">Auto-mute microphone on join</p>
                  <p className="text-[13px] text-[#64748B]">Your microphone will be muted when entering a room.</p>
                </div>
                <Switch
                  className="shrink-0 -my-2 py-2 sm:my-0 sm:py-0"
                  checked={settings.av.autoMute} 
                  onCheckedChange={(v) => setSettings(s => ({...s, av: {...s.av, autoMute: v}}))}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">Turn off camera on join</p>
                  <p className="text-[13px] text-[#64748B]">Your camera will be off when entering a room.</p>
                </div>
                <Switch
                  className="shrink-0 -my-2 py-2 sm:my-0 sm:py-0"
                  checked={settings.av.autoVideoOff} 
                  onCheckedChange={(v) => setSettings(s => ({...s, av: {...s.av, autoVideoOff: v}}))}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">AI Noise Cancellation</p>
                  <p className="text-[13px] text-[#64748B]">Filters out background noise from your microphone.</p>
                </div>
                <Switch
                  className="shrink-0 -my-2 py-2 sm:my-0 sm:py-0"
                  checked={settings.av.noiseCancellation} 
                  onCheckedChange={(v) => setSettings(s => ({...s, av: {...s.av, noiseCancellation: v}}))}
                />
              </div>
              
              <div className="flex justify-end pt-4 border-t border-[#E2E8F0]">
                <Button
                  onClick={handleSave}
                  isLoading={isSaving}
                  className="w-full sm:w-auto bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0"
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "translation" && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Language & Translation</CardTitle>
              <CardDescription>Customize how AI translation works for you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">Show Live Subtitles</p>
                  <p className="text-[13px] text-[#64748B]">Displays translated text on screen during meetings.</p>
                </div>
                <Switch
                  className="shrink-0 -my-2 py-2 sm:my-0 sm:py-0"
                  checked={settings.translation.showSubtitles} 
                  onCheckedChange={(v) => setSettings(s => ({...s, translation: {...s.translation, showSubtitles: v}}))}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">Translation Audio Output</p>
                  <p className="text-[13px] text-[#64748B]">Play synthesized audio in your target language.</p>
                </div>
                <Switch
                  className="shrink-0 -my-2 py-2 sm:my-0 sm:py-0"
                  checked={settings.translation.translationAudio} 
                  onCheckedChange={(v) => setSettings(s => ({...s, translation: {...s.translation, translationAudio: v}}))}
                />
              </div>
              <div className="pt-4 border-t border-[#E2E8F0]">
                <p className="font-medium text-[#0F172A] mb-2">Note on Language Preferences</p>
                <p className="text-[13px] text-[#64748B]">
                  Your default speaking language is currently set to <span className="font-bold text-[#0F172A] uppercase">{user?.preferences?.sourceLanguage || 'en'}</span> and target language to <span className="font-bold text-[#0F172A] uppercase">{user?.preferences?.targetLanguage || 'en'}</span>. 
                  You can change this in your <a href="/profile" className="text-[#3B82F6] hover:underline font-medium">Profile</a>.
                </p>
              </div>
              
              <div className="flex justify-end pt-4 border-t border-[#E2E8F0]">
                <Button
                  onClick={handleSave}
                  isLoading={isSaving}
                  className="w-full sm:w-auto bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0"
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "notifications" && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Control when and how you are notified.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">Email Invitations</p>
                </div>
                <Switch
                  className="shrink-0 -my-2 py-2 sm:my-0 sm:py-0"
                  checked={settings.notifications.emailInvites} 
                  onCheckedChange={(v) => setSettings(s => ({...s, notifications: {...s.notifications, emailInvites: v}}))}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">In-App Notifications</p>
                </div>
                <Switch
                  className="shrink-0 -my-2 py-2 sm:my-0 sm:py-0"
                  checked={settings.notifications.inAppInvites} 
                  onCheckedChange={(v) => setSettings(s => ({...s, notifications: {...s.notifications, inAppInvites: v}}))}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">Meeting Reminders</p>
                </div>
                <Switch
                  className="shrink-0 -my-2 py-2 sm:my-0 sm:py-0"
                  checked={settings.notifications.meetingReminders} 
                  onCheckedChange={(v) => setSettings(s => ({...s, notifications: {...s.notifications, meetingReminders: v}}))}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">Post-Meeting Summary Email</p>
                  <p className="text-[13px] text-[#64748B]">Receive an AI-generated summary after each meeting.</p>
                </div>
                <Switch
                  className="shrink-0 -my-2 py-2 sm:my-0 sm:py-0"
                  checked={settings.notifications.postSummaryEmail} 
                  onCheckedChange={(v) => setSettings(s => ({...s, notifications: {...s.notifications, postSummaryEmail: v}}))}
                />
              </div>
              
              <div className="flex justify-end pt-4 border-t border-[#E2E8F0]">
                <Button
                  onClick={handleSave}
                  isLoading={isSaving}
                  className="w-full sm:w-auto bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0"
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "privacy" && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Privacy & Security</CardTitle>
            </CardHeader>
            {/* This tab previously showed an "Active Sessions" card with a
                hard-coded device and location ("Windows • Chrome", "Karachi,
                PK") that was the same for every user regardless of where they
                actually were, plus two buttons that only fired a success toast:
                "Download my data" and "Request data deletion" did nothing at
                all. Both are removed rather than left as convincing fakes.
                Account deletion is genuinely implemented on the Profile page,
                so people are pointed there. */}
            <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
              <div>
                <h4 className="font-medium text-[#0F172A] mb-2">Your password</h4>
                <p className="text-sm text-[#64748B]">
                  Change your password from the{" "}
                  <Link to="/profile" className="text-[#3B82F6] hover:underline font-medium">
                    Profile page
                  </Link>
                  . Changing it signs out any other device still using the old session.
                </p>
              </div>
              <div className="pt-4 border-t border-[#E2E8F0]">
                <h4 className="font-medium text-[#0F172A] mb-2">Delete your account</h4>
                <p className="text-sm text-[#64748B]">
                  Deleting your account permanently removes your profile and sign-in details. You can do
                  this from the{" "}
                  <Link to="/profile" className="text-[#3B82F6] hover:underline font-medium">
                    Profile page
                  </Link>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
