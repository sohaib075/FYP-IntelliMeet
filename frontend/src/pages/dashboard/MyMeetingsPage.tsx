import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Video, Calendar, Clock, Users, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/Input"
import { meetingApi, describeApiError, type MeetingDto, type MeetingStatusDto } from "@/lib/api"

const statusStyles: Record<MeetingStatusDto, { bg: string; text: string; label: string }> = {
  CREATED: { bg: "bg-[#EFF6FF]", text: "text-[#3B82F6]", label: "Not started" },
  ACTIVE: { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: "In progress" },
  ENDED: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", label: "Ended" },
}

function formatDuration(m: MeetingDto): string {
  if (!m.startedAt || !m.endedAt) return "—"
  const secs = Math.max(0, (new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 1000)
  const h = Math.floor(secs / 3600)
  const min = Math.round((secs % 3600) / 60)
  return h ? `${h}h ${min}m` : `${min}m`
}

export function MyMeetingsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming")
  const [search, setSearch] = useState("")
  const [meetings, setMeetings] = useState<MeetingDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    meetingApi
      .list()
      .then(({ meetings }) => { if (!cancelled) setMeetings(meetings) })
      .catch((err) => { if (!cancelled) setError(describeApiError(err)) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const upcomingMeetings = meetings.filter((m) => m.status !== "ENDED")
  const pastMeetings = meetings.filter((m) => m.status === "ENDED")

  const list = activeTab === "upcoming" ? upcomingMeetings : pastMeetings
  const filtered = list.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase()) || m.meetingId.includes(search.toLowerCase())
  )

  return (
    <div className="w-full max-w-5xl mx-auto p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-[#0F172A]">My Meetings</h1>
          <p className="text-[#64748B] text-sm mt-1">Meetings you host or have joined.</p>
        </div>
        <Button asChild className="bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0">
          <Link to="/meeting/create">
            <Video className="h-4 w-4 mr-2" />
            New Meeting
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[#E2E8F0]">
        <button
          onClick={() => setActiveTab("upcoming")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "upcoming" ? "border-[#3B82F6] text-[#3B82F6]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Upcoming ({upcomingMeetings.length})
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "past" ? "border-[#3B82F6] text-[#3B82F6]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Past ({pastMeetings.length})
        </button>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search by title or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-[14px] text-red-600">{error}</div>
      )}

      {/* Meeting List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#3B82F6] mx-auto" />
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Video className="h-10 w-10 text-[#94A3B8] mx-auto mb-3" />
              <p className="text-[#64748B] text-sm">
                {search ? "No meetings match your search." : activeTab === "upcoming" ? "No upcoming meetings. Create one to get started." : "No past meetings yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((meeting) => {
            const status = statusStyles[meeting.status]
            const when = meeting.scheduledFor || meeting.startedAt || meeting.createdAt
            return (
              <Card key={meeting.meetingId} className="hover:shadow-md transition-shadow border-[#E2E8F0] bg-white">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-[15px] font-semibold text-[#0F172A] truncate">{meeting.title}</h3>
                        <span className={`shrink-0 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[#64748B]">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(when).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(when).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          {meeting.status === "ENDED" && ` · ${formatDuration(meeting)}`}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {meeting.participantCount} {meeting.participantCount === 1 ? "participant" : "participants"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[12px] text-[#94A3B8]">Host: {meeting.isHost ? "You" : meeting.host.name || "—"}</span>
                        <span className="text-[#E2E8F0]">·</span>
                        <button
                          type="button"
                          className="text-[11px] font-mono bg-[#F8FAFC] text-[#3B82F6] font-semibold border border-[#E2E8F0] px-2 py-0.5 rounded cursor-pointer hover:bg-[#EFF6FF] transition-colors"
                          title="Click to copy code"
                          onClick={() => navigator.clipboard.writeText(meeting.meetingId).catch(() => {})}
                        >
                          {meeting.meetingId}
                        </button>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {meeting.status === "CREATED" && (
                        <Button onClick={() => navigate(`/meet/${meeting.meetingId}`)} className="bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0" size="sm">
                          {meeting.isHost ? "Start" : "Join"}
                        </Button>
                      )}
                      {meeting.status === "ACTIVE" && (
                        <Button onClick={() => navigate(`/meet/${meeting.meetingId}`)} className="bg-[#D97706] text-white hover:bg-[#B45309] border-0" size="sm">
                          Rejoin
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
