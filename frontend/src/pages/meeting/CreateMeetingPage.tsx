import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Copy, Calendar as CalendarIcon, Clock, CheckCircle2, ClipboardCheck } from "lucide-react"
import { useToastStore } from "@/store/useToastStore"
import { meetingApi, describeApiError, type MeetingDto } from "@/lib/api"
import { meetingLink } from "@/lib/meetingId"

export function CreateMeetingPage() {
  const navigate = useNavigate()
  const addToast = useToastStore((state) => state.addToast)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [meetingDetails, setMeetingDetails] = useState({
    title: "New Meeting",
    type: "instant",
    date: "",
    time: "",
    primaryLang: "en",
    secondaryLang: "zh",
  })
  const [created, setCreated] = useState<MeetingDto | null>(null)
  const [isCopiedId, setIsCopiedId] = useState(false)
  const [isCopiedLink, setIsCopiedLink] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      // The server generates the id and records the caller as host.
      const scheduledFor =
        meetingDetails.type === "scheduled" && meetingDetails.date && meetingDetails.time
          ? new Date(`${meetingDetails.date}T${meetingDetails.time}`).toISOString()
          : undefined
      const { meeting } = await meetingApi.create({
        title: meetingDetails.title.trim() || "Untitled meeting",
        scheduledFor,
      })
      setCreated(meeting)
    } catch (err) {
      setError(describeApiError(err))
    } finally {
      setIsLoading(false)
    }
  }

  const copy = async (text: string, onDone: () => void, message: string) => {
    try {
      await navigator.clipboard.writeText(text)
      onDone()
      addToast({ message, variant: "success" })
    } catch {
      addToast({ message: "Couldn't copy. Select the text and copy it manually.", variant: "error" })
    }
  }

  const copyId = () => {
    if (!created) return
    copy(created.meetingId, () => {
      setIsCopiedId(true)
      setTimeout(() => setIsCopiedId(false), 2000)
    }, "Meeting code copied")
  }

  const copyLink = () => {
    if (!created) return
    copy(meetingLink(created.meetingId), () => {
      setIsCopiedLink(true)
      setTimeout(() => setIsCopiedLink(false), 2000)
    }, "Invite link copied")
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 p-4 sm:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#0F172A]">Create Meeting</h1>
      {!created ? (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl text-[#0F172A] font-display">Create New Meeting</CardTitle>
            <CardDescription>Configure your meeting room settings.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {error && (
              <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-[14px] text-red-600 break-words">
                {error}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-6">
              <Input
                label="Meeting Title"
                required
                value={meetingDetails.title}
                onChange={(e) => setMeetingDetails({ ...meetingDetails, title: e.target.value })}
                minLength={1}
                maxLength={100}
                className="h-11 sm:h-10 text-[16px] sm:text-sm"
              />

              <div>
                <label className="block text-[13px] font-medium text-[#0F172A] mb-1.5">Meeting Type</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex min-h-10 sm:min-h-0 items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      className="text-[#3B82F6] bg-white border-[#E2E8F0] focus:ring-[#3B82F6]"
                      checked={meetingDetails.type === "instant"}
                      onChange={() => setMeetingDetails({ ...meetingDetails, type: "instant" })}
                    />
                    <span className="text-[14px] text-[#0F172A]">Instant Meeting</span>
                  </label>
                  <label className="flex min-h-10 sm:min-h-0 items-center gap-2 cursor-pointer">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Date"
                    type="date"
                    icon={<CalendarIcon className="h-4 w-4" />}
                    required
                    value={meetingDetails.date}
                    onChange={(e) => setMeetingDetails({ ...meetingDetails, date: e.target.value })}
                    className="h-11 sm:h-10 text-[16px] sm:text-sm"
                  />
                  <Input
                    label="Time"
                    type="time"
                    icon={<Clock className="h-4 w-4" />}
                    required
                    value={meetingDetails.time}
                    onChange={(e) => setMeetingDetails({ ...meetingDetails, time: e.target.value })}
                    className="h-11 sm:h-10 text-[16px] sm:text-sm"
                  />
                </div>
              )}

              <div className="p-4 sm:p-5 rounded-lg bg-white border border-[#E2E8F0] space-y-4">
                <h4 className="font-medium text-[#0F172A] text-sm">Meeting Language Configuration</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Primary Language</label>
                    <Select value={meetingDetails.primaryLang} onValueChange={(v) => setMeetingDetails({ ...meetingDetails, primaryLang: v })}>
                      <SelectTrigger className="h-11 sm:h-10"><SelectValue /></SelectTrigger>
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
                      <SelectTrigger className="h-11 sm:h-10"><SelectValue /></SelectTrigger>
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

              <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4">
                <Button variant="ghost" type="button" onClick={() => navigate("/dashboard")} className="h-11 sm:h-10 w-full sm:w-auto text-[#64748B] hover:text-[#0F172A]">Cancel</Button>
                <Button type="submit" isLoading={isLoading} className="h-11 sm:h-10 w-full sm:w-auto bg-[#3B82F6] text-white hover:bg-[#2563EB]">Create Meeting</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="text-center overflow-hidden border-[#22C55E]/30 shadow-lg bg-white">
          <div className="bg-[#DCFCE7] p-6 sm:p-8 flex flex-col items-center">
            <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-[#22C55E] mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-2 font-display">Meeting Created</h2>
            <p className="text-[#64748B] max-w-md break-words">
              <span className="font-semibold text-[#0F172A]">{created.title}</span> is ready. Share the code or link below to invite participants. You are the host.
            </p>
          </div>

          <CardContent className="p-4 sm:p-8 space-y-6">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 sm:p-6 max-w-md mx-auto relative group hover:border-[#3B82F6]/50 transition-all flex flex-col items-center gap-3">
              <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase">Meeting Code</span>
              <p className="w-full text-2xl sm:text-3xl font-mono tracking-wider sm:tracking-widest text-[#0F172A] font-extrabold select-all break-all">{created.meetingId}</p>
              <Button
                onClick={copyId}
                className="mt-2 h-10 sm:h-9 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg flex items-center gap-2 text-xs font-semibold shadow-sm"
              >
                {isCopiedId ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {isCopiedId ? "Copied!" : "Copy Meeting Code"}
              </Button>
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <label className="block text-left text-xs font-semibold text-[#64748B] uppercase">Invitation Link</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Input readOnly value={meetingLink(created.meetingId)} className="h-11 sm:h-10 font-mono text-[16px] sm:text-sm bg-[#F8FAFC] min-w-0" />
                <Button
                  onClick={copyLink}
                  title="Copy Link"
                  className="bg-[#EFF6FF] text-[#3B82F6] hover:bg-[#DBEAFE] h-11 sm:h-10 px-4 rounded-lg shrink-0 flex items-center justify-center gap-1.5 font-semibold text-xs border border-[#BFDBFE]"
                >
                  {isCopiedLink ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {isCopiedLink ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="pt-6 flex flex-col sm:flex-row justify-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")} className="h-11 sm:h-10 text-[#64748B] hover:text-[#0F172A] font-medium">Go to Dashboard</Button>
              <Button size="lg" onClick={() => navigate(`/meet/${created.meetingId}`)} className="bg-[#3B82F6] text-white hover:bg-[#2563EB] font-semibold px-6 rounded-lg">
                Start Meeting Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
