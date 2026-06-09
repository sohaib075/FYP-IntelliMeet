import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/Switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { useAuthStore } from "@/store/useAuthStore"
import { useToastStore } from "@/store/useToastStore"
import { Button } from "@/components/ui/Button"

export function SettingsPage() {
  const { user, updatePreferences, updateProfile } = useAuthStore()
  const addToast = useToastStore((state) => state.addToast)
  const [isSaving, setIsSaving] = useState(false)

  const [settings, setSettings] = useState({
    general: {
      displayName: "John Doe",
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

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      try {
        localStorage.setItem("intellimeet-app-settings", JSON.stringify(settings))
        
        // Sync with Auth Store
        if (settings.general.displayName.trim()) {
          updateProfile(settings.general.displayName.trim())
        }
        
        addToast({ message: "Settings saved successfully!", variant: "success" })
      } catch (err) {
        console.error(err)
        addToast({ message: "Failed to save settings.", variant: "error" })
      } finally {
        setIsSaving(false)
      }
    }, 800)
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
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-64 shrink-0">
        <h1 className="text-3xl font-bold font-display tracking-tight mb-6">Settings</h1>
        <div className="flex md:flex-col overflow-x-auto gap-2 md:gap-1 pb-4 md:pb-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-2 text-[14px] font-medium rounded-lg text-left transition-colors ${
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

      <div className="flex-1 space-y-6">
        {activeTab === "general" && (
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure your general IntelliMeet experience.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                  className="bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0"
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "av" && (
          <Card>
            <CardHeader>
              <CardTitle>Audio & Video</CardTitle>
              <CardDescription>Manage your default devices and meeting entry behavior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#0F172A]">Auto-mute microphone on join</p>
                  <p className="text-[13px] text-[#64748B]">Your microphone will be muted when entering a room.</p>
                </div>
                <Switch 
                  checked={settings.av.autoMute} 
                  onCheckedChange={(v) => setSettings(s => ({...s, av: {...s.av, autoMute: v}}))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#0F172A]">Turn off camera on join</p>
                  <p className="text-[13px] text-[#64748B]">Your camera will be off when entering a room.</p>
                </div>
                <Switch 
                  checked={settings.av.autoVideoOff} 
                  onCheckedChange={(v) => setSettings(s => ({...s, av: {...s.av, autoVideoOff: v}}))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#0F172A]">AI Noise Cancellation</p>
                  <p className="text-[13px] text-[#64748B]">Filters out background noise from your microphone.</p>
                </div>
                <Switch 
                  checked={settings.av.noiseCancellation} 
                  onCheckedChange={(v) => setSettings(s => ({...s, av: {...s.av, noiseCancellation: v}}))}
                />
              </div>
              
              <div className="flex justify-end pt-4 border-t border-[#E2E8F0]">
                <Button 
                  onClick={handleSave} 
                  isLoading={isSaving}
                  className="bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0"
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "translation" && (
          <Card>
            <CardHeader>
              <CardTitle>Language & Translation</CardTitle>
              <CardDescription>Customize how AI translation works for you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#0F172A]">Show Live Subtitles</p>
                  <p className="text-[13px] text-[#64748B]">Displays translated text on screen during meetings.</p>
                </div>
                <Switch 
                  checked={settings.translation.showSubtitles} 
                  onCheckedChange={(v) => setSettings(s => ({...s, translation: {...s.translation, showSubtitles: v}}))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#0F172A]">Translation Audio Output</p>
                  <p className="text-[13px] text-[#64748B]">Play synthesized audio in your target language.</p>
                </div>
                <Switch 
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
                  className="bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0"
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "notifications" && (
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Control when and how you are notified.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#0F172A]">Email Invitations</p>
                </div>
                <Switch 
                  checked={settings.notifications.emailInvites} 
                  onCheckedChange={(v) => setSettings(s => ({...s, notifications: {...s.notifications, emailInvites: v}}))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#0F172A]">In-App Notifications</p>
                </div>
                <Switch 
                  checked={settings.notifications.inAppInvites} 
                  onCheckedChange={(v) => setSettings(s => ({...s, notifications: {...s.notifications, inAppInvites: v}}))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#0F172A]">Meeting Reminders</p>
                </div>
                <Switch 
                  checked={settings.notifications.meetingReminders} 
                  onCheckedChange={(v) => setSettings(s => ({...s, notifications: {...s.notifications, meetingReminders: v}}))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#0F172A]">Post-Meeting Summary Email</p>
                  <p className="text-[13px] text-[#64748B]">Receive an AI-generated summary after each meeting.</p>
                </div>
                <Switch 
                  checked={settings.notifications.postSummaryEmail} 
                  onCheckedChange={(v) => setSettings(s => ({...s, notifications: {...s.notifications, postSummaryEmail: v}}))}
                />
              </div>
              
              <div className="flex justify-end pt-4 border-t border-[#E2E8F0]">
                <Button 
                  onClick={handleSave} 
                  isLoading={isSaving}
                  className="bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0"
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "privacy" && (
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium text-[#0F172A] mb-2">Active Sessions</h4>
                <div className="rounded-lg border border-[#E2E8F0] p-4 flex justify-between items-center bg-[#F8FAFC]">
                  <div>
                    <p className="font-medium text-[#0F172A] text-sm">Windows • Chrome</p>
                    <p className="text-xs text-[#64748B]">Karachi, PK (Current Session)</p>
                  </div>
                  <Badge variant="active">Active</Badge>
                </div>
              </div>
              <div className="pt-4 border-t border-[#E2E8F0]">
                <h4 className="font-medium text-[#0F172A] mb-2">Data Preferences</h4>
                <div className="flex gap-4">
                  <button 
                    onClick={() => addToast({ message: "Preparing your data archive. You will receive an email shortly.", variant: "success" })}
                    className="text-sm text-[#3B82F6] hover:underline bg-transparent border-0 cursor-pointer p-0 font-medium"
                  >
                    Download my data
                  </button>
                  <button 
                    onClick={() => addToast({ message: "Data deletion request submitted successfully.", variant: "success" })}
                    className="text-sm text-red-600 hover:underline bg-transparent border-0 cursor-pointer p-0 font-medium"
                  >
                    Request data deletion
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
