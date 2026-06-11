import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Video, Calendar, Clock, Users, ExternalLink, Search } from "lucide-react"
import { Input } from "@/components/ui/Input"

type MeetingStatus = "scheduled" | "in-progress" | "completed" | "cancelled"

interface Meeting {
  id: string
  title: string
  date: string
  time: string
  duration: string
  participants: number
  status: MeetingStatus
  host: string
  languages: string[]
}

const mockUpcoming: Meeting[] = [
  {
    id: "meet-001",
    title: "CPEC Quarterly Review",
    date: "2026-06-12",
    time: "10:00 AM",
    duration: "1h 30m",
    participants: 8,
    status: "scheduled",
    host: "You",
    languages: ["English", "Chinese"],
  },
  {
    id: "meet-002",
    title: "Cross-Border Engineering Sync",
    date: "2026-06-14",
    time: "2:00 PM",
    duration: "45m",
    participants: 5,
    status: "scheduled",
    host: "You",
    languages: ["English", "Urdu", "Chinese"],
  },
  {
    id: "meet-003",
    title: "Academic Research Collaboration",
    date: "2026-06-15",
    time: "11:00 AM",
    duration: "1h",
    participants: 12,
    status: "scheduled",
    host: "Dr. Li Wei",
    languages: ["English", "Chinese"],
  },
]

const mockPast: Meeting[] = [
  {
    id: "meet-101",
    title: "Infrastructure Planning Session",
    date: "2026-06-05",
    time: "9:00 AM",
    duration: "2h 15m",
    participants: 10,
    status: "completed",
    host: "You",
    languages: ["English", "Urdu"],
  },
  {
    id: "meet-102",
    title: "Budget Alignment Meeting",
    date: "2026-06-03",
    time: "3:00 PM",
    duration: "1h",
    participants: 6,
    status: "completed",
    host: "Ahmed Khan",
    languages: ["English", "Urdu", "Chinese"],
  },
  {
    id: "meet-103",
    title: "Team Standup (Cancelled)",
    date: "2026-06-01",
    time: "10:00 AM",
    duration: "—",
    participants: 4,
    status: "cancelled",
    host: "You",
    languages: ["English"],
  },
  {
    id: "meet-104",
    title: "Product Demo – Phase 2",
    date: "2026-05-28",
    time: "1:00 PM",
    duration: "50m",
    participants: 15,
    status: "completed",
    host: "You",
    languages: ["English", "Chinese"],
  },
]

const statusStyles: Record<MeetingStatus, { bg: string; text: string; label: string }> = {
  scheduled: { bg: "bg-[#EFF6FF]", text: "text-[#3B82F6]", label: "Scheduled" },
  "in-progress": { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: "In Progress" },
  completed: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", label: "Completed" },
  cancelled: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", label: "Cancelled" },
}

export function MyMeetingsPage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming")
  const [search, setSearch] = useState("")
  const [scheduledMeetings, setScheduledMeetings] = useState<Meeting[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem("intellimeet_scheduled_meetings")
      if (stored) {
        setScheduledMeetings(JSON.parse(stored))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const upcomingMeetings = [...scheduledMeetings.filter(m => m.status === "scheduled" || m.status === "in-progress"), ...mockUpcoming]
  const pastMeetings = [...scheduledMeetings.filter(m => m.status === "completed" || m.status === "cancelled"), ...mockPast]

  const meetings = activeTab === "upcoming" ? upcomingMeetings : pastMeetings
  const filtered = meetings.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="w-full max-w-5xl mx-auto p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-[#0F172A]">My Meetings</h1>
          <p className="text-[#64748B] text-sm mt-1">View and manage your scheduled and past meetings.</p>
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
            activeTab === "upcoming"
              ? "border-[#3B82F6] text-[#3B82F6]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Upcoming ({upcomingMeetings.length})
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "past"
              ? "border-[#3B82F6] text-[#3B82F6]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Past ({pastMeetings.length})
        </button>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search meetings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* Meeting List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Video className="h-10 w-10 text-[#94A3B8] mx-auto mb-3" />
              <p className="text-[#64748B] text-sm">
                {search ? "No meetings match your search." : "No meetings found."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((meeting) => {
            const status = statusStyles[meeting.status]
            return (
              <Card
                key={meeting.id}
                className="hover:shadow-md transition-shadow border-[#E2E8F0] bg-white"
              >
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-[15px] font-semibold text-[#0F172A] truncate">
                          {meeting.title}
                        </h3>
                        <span
                          className={`shrink-0 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${status.bg} ${status.text}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[#64748B]">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(meeting.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {meeting.time} · {meeting.duration}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {meeting.participants} participants
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[12px] text-[#94A3B8]">Host: {meeting.host}</span>
                        <span className="text-[#E2E8F0]">·</span>
                        <span className="text-[11px] font-mono bg-[#F8FAFC] text-[#3B82F6] font-semibold border border-[#E2E8F0] px-2 py-0.5 rounded cursor-pointer hover:bg-[#EFF6FF] transition-colors" title="Click to copy ID" onClick={() => {
                          navigator.clipboard.writeText(meeting.id);
                        }}>
                          ID: {meeting.id}
                        </span>
                        <span className="text-[#E2E8F0]">·</span>
                        {meeting.languages.map((lang) => (
                          <span
                            key={lang}
                            className="text-[11px] bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded-full"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {meeting.status === "scheduled" && (
                        <Button asChild className="bg-[#3B82F6] text-white hover:bg-[#2563EB] border-0" size="sm">
                          <Link to={`/meeting/lobby/${meeting.id}`}>Join</Link>
                        </Button>
                      )}
                      {meeting.status === "completed" && (
                        <Button
                          asChild
                          className="bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0] border-0"
                          size="sm"
                        >
                          <Link to={`/meeting/summary/${meeting.id}`}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Summary
                          </Link>
                        </Button>
                      )}
                      {meeting.status === "in-progress" && (
                        <Button asChild className="bg-[#D97706] text-white hover:bg-[#B45309] border-0" size="sm">
                          <Link to={`/meeting/room/${meeting.id}`}>Rejoin</Link>
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
