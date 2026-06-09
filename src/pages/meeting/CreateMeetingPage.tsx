import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Switch } from "@/components/ui/Switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Copy, Calendar as CalendarIcon, Clock, CheckCircle2, ClipboardCheck } from "lucide-react"
import { useToastStore } from "@/store/useToastStore"

export function CreateMeetingPage() {
  const navigate = useNavigate()
  const addToast = useToastStore((state) => state.addToast)
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [meetingDetails, setMeetingDetails] = useState({
    title: "New Meeting",
    type: "instant",
    date: "",
    time: "",
    primaryLang: "en",
    secondaryLang: "zh",
    requireLogin: false
  })
  const [generatedId, setGeneratedId] = useState("")
  const [isCopiedId, setIsCopiedId] = useState(false)
  const [isCopiedLink, setIsCopiedLink] = useState(false)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      const newId = `im-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`
      setGeneratedId(newId)
      setStep(2)
    }, 1000)
  }

  const copyId = () => {
    navigator.clipboard.writeText(generatedId)
    setIsCopiedId(true)
    addToast({ message: "Meeting ID copied successfully!", variant: "success" })
    setTimeout(() => setIsCopiedId(false), 2000)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`https://intellimeet.app/join/${generatedId}`)
    setIsCopiedLink(true)
    addToast({ message: "Join link copied successfully!", variant: "success" })
    setTimeout(() => setIsCopiedLink(false), 2000)
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 p-8">
      <h1 className="text-3xl font-bold font-display tracking-tight text-[#0F172A]">Create Meeting</h1>
      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-[#0F172A] font-display">Create New Meeting</CardTitle>
            <CardDescription>Configure your meeting room settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <Input
                label="Meeting Title"
                required
                value={meetingDetails.title}
                onChange={(e) => setMeetingDetails({ ...meetingDetails, title: e.target.value })}
                minLength={3}
                maxLength={100}
              />

              <div>
                <label className="block text-[13px] font-medium text-[#0F172A] mb-1.5">Meeting Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      className="text-[#3B82F6] bg-white border-[#E2E8F0] focus:ring-[#3B82F6]"
                      checked={meetingDetails.type === "instant"}
                      onChange={() => setMeetingDetails({ ...meetingDetails, type: "instant" })}
                    />
                    <span className="text-[14px] text-[#0F172A]">Instant Meeting</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      className="text-[#3B82F6] bg-white border-[#E2E8F0] focus:ring-[#3B82F6]"
                      checked={meetingDetails.type === "scheduled"}
                      onChange={() => setMeetingDetails({ ...meetingDetails, type: "scheduled" })}
                    />
                    <span className="text-[14px] text-[#0F172A]">Scheduled</span>
                  </label>
                </div>
              </div>

              {meetingDetails.type === "scheduled" && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Date"
                    type="date"
                    icon={<CalendarIcon className="h-4 w-4" />}
                    required
                    value={meetingDetails.date}
                    onChange={(e) => setMeetingDetails({ ...meetingDetails, date: e.target.value })}
                  />
                  <Input
                    label="Time"
                    type="time"
                    icon={<Clock className="h-4 w-4" />}
                    required
                    value={meetingDetails.time}
                    onChange={(e) => setMeetingDetails({ ...meetingDetails, time: e.target.value })}
                  />
                </div>
              )}

              <div className="p-5 rounded-lg bg-white border border-[#E2E8F0] space-y-4">
                <h4 className="font-medium text-[#0F172A] text-sm">Meeting Language Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Primary Language</label>
                    <Select value={meetingDetails.primaryLang} onValueChange={(v) => setMeetingDetails({ ...meetingDetails, primaryLang: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                        <SelectItem value="ur">🇵🇰 Urdu</SelectItem>
                        <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Secondary Language</label>
                    <Select value={meetingDetails.secondaryLang} onValueChange={(v) => setMeetingDetails({ ...meetingDetails, secondaryLang: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                        <SelectItem value="ur">🇵🇰 Urdu</SelectItem>
                        <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[13px] text-[#64748B]">Each participant can override these with their personal settings.</p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0]">
                <div>
                  <p className="font-medium text-[#0F172A] text-[14px]">Meeting Security</p>
                  <p className="text-[13px] text-[#64748B]">Require participants to be logged in to join.</p>
                </div>
                <Switch 
                  checked={meetingDetails.requireLogin}
                  onCheckedChange={(v) => setMeetingDetails({ ...meetingDetails, requireLogin: v })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" type="button" onClick={() => navigate("/dashboard")} className="text-[#64748B] hover:text-[#0F172A]">Cancel</Button>
                <Button type="submit" isLoading={isLoading} className="bg-[#3B82F6] text-white hover:bg-[#2563EB]">Create Meeting</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="text-center overflow-hidden border-[#22C55E]/30 shadow-lg bg-white">
          <div className="bg-[#DCFCE7] p-8 flex flex-col items-center">
            <CheckCircle2 className="h-16 w-16 text-[#22C55E] mb-4" />
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2 font-display">Meeting Created Successfully</h2>
            <p className="text-[#64748B] max-w-md">Your meeting room is ready. Share the ID or link below to invite participants.</p>
          </div>
          
          <CardContent className="p-8 space-y-6">
            {/* Interactive Meeting ID Card */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6 max-w-md mx-auto relative group hover:border-[#3B82F6]/50 transition-all flex flex-col items-center gap-3">
              <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase">Meeting ID</span>
              <p className="text-3.5xl font-mono tracking-widest text-[#0F172A] font-extrabold select-all">{generatedId}</p>
              <Button 
                onClick={copyId} 
                className="mt-2 h-9 px-4.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg flex items-center gap-2 text-xs font-semibold shadow-sm"
              >
                {isCopiedId ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {isCopiedId ? "Copied ID!" : "Copy Meeting ID"}
              </Button>
            </div>

            {/* Direct Invitation Link */}
            <div className="max-w-md mx-auto space-y-2">
              <label className="block text-left text-xs font-semibold text-[#64748B] uppercase">Invitation Link</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`https://intellimeet.app/join/${generatedId}`}
                  className="font-mono text-sm bg-[#F8FAFC]"
                />
                <Button 
                  onClick={copyLink} 
                  title="Copy Link" 
                  className="bg-[#EFF6FF] text-[#3B82F6] hover:bg-[#DBEAFE] h-10 px-4 rounded-lg shrink-0 flex items-center gap-1.5 font-semibold text-xs border border-[#BFDBFE]"
                >
                  {isCopiedLink ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {isCopiedLink ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="pt-6 flex flex-col sm:flex-row justify-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-[#64748B] hover:text-[#0F172A] font-medium">Go to Dashboard</Button>
              <Button size="lg" onClick={() => navigate(`/meeting/lobby/${generatedId}`)} className="bg-[#3B82F6] text-white hover:bg-[#2563EB] font-semibold px-6 rounded-lg">
                Start Meeting Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
