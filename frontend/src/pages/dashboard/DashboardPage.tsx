import { Button } from "@/components/ui/Button"
import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { meetingApi, describeApiError, type MeetingDto } from "@/lib/api"
import { normalizeMeetingId } from "@/lib/meetingId"

function formatDuration(m: MeetingDto): string {
  if (!m.startedAt || !m.endedAt) return "—"
  const secs = Math.max(0, (new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 1000)
  const h = Math.floor(secs / 3600)
  const min = Math.round((secs % 3600) / 60)
  return h ? `${h}h ${min}m` : `${min}m`
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [joinId, setJoinId] = useState("")
  const [joinError, setJoinError] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [meetings, setMeetings] = useState<MeetingDto[]>([])
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    let cancelled = false
    meetingApi
      .list()
      .then(({ meetings }) => { if (!cancelled) setMeetings(meetings) })
      .catch((err) => { if (!cancelled) setLoadError(describeApiError(err)) })
    return () => { cancelled = true }
  }, [])

  const handleJoin = async () => {
    setJoinError("")
    const normalized = normalizeMeetingId(joinId)
    if (!normalized) {
      setJoinError("That doesn't look like a meeting code. Codes look like abc-defg-hij.")
      return
    }
    setIsJoining(true)
    try {
      const { meeting } = await meetingApi.get(normalized)
      if (meeting.status === "ENDED") {
        setJoinError("This meeting has ended.")
        return
      }
      navigate(`/meet/${meeting.meetingId}`)
    } catch (err) {
      setJoinError(describeApiError(err))
    } finally {
      setIsJoining(false)
    }
  }

  const handleStartInstant = async () => {
    setIsStarting(true)
    try {
      const { meeting } = await meetingApi.create({ title: "Instant meeting" })
      navigate(`/meet/${meeting.meetingId}`)
    } catch (err) {
      setLoadError(describeApiError(err))
      setIsStarting(false)
    }
  }

  const upcoming = meetings.filter((m) => m.status !== "ENDED")
  const recent = meetings.filter((m) => m.status === "ENDED").slice(0, 5)
  const hosted = meetings.filter((m) => m.isHost)
  const hoursConnected = meetings.reduce((sum, m) => {
    if (!m.startedAt || !m.endedAt) return sum
    return sum + (new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 3_600_000
  }, 0)
  const participantsReached = hosted.reduce((sum, m) => sum + Math.max(0, m.participantCount - 1), 0)

  const stats = [
    { title: "Meetings Hosted", value: String(hosted.length), sub: "all time" },
    { title: "Meetings Attended", value: String(meetings.length - hosted.length), sub: "all time" },
    { title: "Hours Connected", value: hoursConnected.toFixed(1), sub: "all time" },
    { title: "Participants Reached", value: String(participantsReached), sub: "in meetings you hosted" },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto space-y-6">

      {/* Quick Actions Row */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Card 1: New Meeting */}
        <div className="w-full md:w-1/3 bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 flex flex-col justify-between items-start gap-4 shadow-sm hover:border-[#3B82F6] transition-colors">
          <div>
            <h3 className="text-[16px] font-semibold text-[#0F172A] font-display">New Meeting</h3>
            <p className="text-[13px] text-[#64748B] mt-1">Start an instant room. You'll be the host.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleStartInstant}
              isLoading={isStarting}
              className="bg-[#3B82F6] text-white hover:bg-[#2563EB] h-[40px] sm:h-[36px] px-4 text-[14px] rounded-lg border-0"
            >
              Start Now
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/meeting/create")}
              className="h-[40px] sm:h-[36px] px-3 text-[14px] text-[#3B82F6]"
            >
              Schedule
            </Button>
          </div>
        </div>

        {/* Card 2: Join Meeting */}
        <div className="w-full md:w-2/3 bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-[#3B82F6] transition-colors">
          <div className="mb-4">
            <h3 className="text-[16px] font-semibold text-[#0F172A] font-display">Join a Meeting</h3>
            <p className="text-[13px] text-[#64748B] mt-1">Enter a meeting code or paste an invite link</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
            <input
              type="text"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="e.g. abc-defg-hij"
              aria-label="Meeting code"
              autoComplete="off"
              spellCheck={false}
              className="w-full min-w-0 sm:flex-1 h-[40px] px-3 bg-white border border-[#E2E8F0] rounded-lg text-[14px] font-mono text-[#0F172A] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/10 transition-all placeholder:text-[#94A3B8] placeholder:font-sans"
            />
            <Button
              onClick={handleJoin}
              disabled={!joinId.trim()}
              isLoading={isJoining}
              className="bg-[#3B82F6] text-white hover:bg-[#2563EB] disabled:opacity-50 h-[40px] px-6 text-[14px] rounded-lg border-0 w-full sm:w-auto"
            >
              Join
            </Button>
          </div>
          {joinError && <p role="alert" className="text-[13px] text-red-600 mt-2">{joinError}</p>}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-[14px] text-red-600">{loadError}</div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.title} className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-sm">
            <h4 className="text-[13px] font-medium text-[#64748B] mb-2">{stat.title}</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-bold text-[#0F172A] font-display tabular-nums">{stat.value}</span>
            </div>
            <p className="text-[12px] text-[#94A3B8] mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Upcoming / Active Meetings */}
      {upcoming.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-[16px] font-semibold text-[#0F172A] font-display">Your Meetings</h2>
            <button
              onClick={() => navigate('/dashboard/meetings')}
              className="min-h-[40px] sm:min-h-0 text-[13px] font-medium text-[#3B82F6] hover:text-[#2563EB] bg-transparent border-0 cursor-pointer"
            >
              View all &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcoming.slice(0, 4).map((meeting) => (
              <div key={meeting.meetingId} className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-sm hover:border-[#3B82F6] transition-all flex justify-between items-start gap-3 sm:gap-4">
                <div className="space-y-2 min-w-0">
                  <h3 className="text-[15px] font-semibold text-[#0F172A] truncate max-w-full">{meeting.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs text-[#64748B]">
                    <button
                      type="button"
                      className="max-w-full truncate font-mono text-[#3b82f6] font-semibold bg-blue-50 px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-100 transition-colors border-0"
                      title="Click to copy code"
                      onClick={() => navigator.clipboard.writeText(meeting.meetingId).catch(() => {})}
                    >
                      {meeting.meetingId}
                    </button>
                    <span>{meeting.scheduledFor ? `Scheduled ${formatDate(meeting.scheduledFor)}` : `Created ${formatDate(meeting.createdAt)}`}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${meeting.status === "ACTIVE" ? "bg-[#FEF3C7] text-[#D97706]" : "bg-[#EFF6FF] text-[#3B82F6]"}`}>
                      {meeting.status === "ACTIVE" ? "In progress" : "Not started"}
                    </span>
                    {meeting.isHost && <span className="text-[10px] bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded-full">Host</span>}
                  </div>
                </div>
                <Button
                  onClick={() => navigate(`/meet/${meeting.meetingId}`)}
                  className="bg-[#3B82F6] text-white hover:bg-[#2563EB] h-10 sm:h-9 px-4 text-xs font-semibold rounded-lg border-0 shrink-0"
                >
                  {meeting.status === "ACTIVE" ? "Rejoin" : meeting.isHost ? "Start" : "Join"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Meetings Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[16px] font-semibold text-[#0F172A] font-display">Recent Meetings</h2>
          <button
            onClick={() => navigate('/dashboard/meetings')}
            className="min-h-[40px] sm:min-h-0 text-[13px] font-medium text-[#3B82F6] hover:text-[#2563EB] bg-transparent border-0 cursor-pointer"
          >
            View all &rarr;
          </button>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
          {recent.length === 0 ? (
            <p className="p-6 sm:p-8 text-center text-[14px] text-[#64748B]">No finished meetings yet. Start one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="whitespace-nowrap px-4 sm:px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Meeting</th>
                    <th className="whitespace-nowrap px-4 sm:px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider hidden sm:table-cell">Code</th>
                    <th className="whitespace-nowrap px-4 sm:px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider hidden md:table-cell">Date</th>
                    <th className="whitespace-nowrap px-4 sm:px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider hidden lg:table-cell">Duration</th>
                    <th className="whitespace-nowrap px-4 sm:px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider hidden sm:table-cell">Participants</th>
                    <th className="whitespace-nowrap px-4 sm:px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {recent.map((meeting) => (
                    <tr key={meeting.meetingId} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 sm:px-5 py-4 text-[14px] font-medium text-[#0F172A] break-words">{meeting.title}</td>
                      <td className="px-4 sm:px-5 py-4 text-[13px] font-mono text-[#64748B] hidden sm:table-cell">{meeting.meetingId}</td>
                      <td className="px-4 sm:px-5 py-4 text-[14px] text-[#64748B] hidden md:table-cell">{formatDate(meeting.startedAt || meeting.createdAt)}</td>
                      <td className="px-4 sm:px-5 py-4 text-[14px] text-[#64748B] hidden lg:table-cell tabular-nums">{formatDuration(meeting)}</td>
                      <td className="px-4 sm:px-5 py-4 text-[14px] text-[#64748B] hidden sm:table-cell tabular-nums">{meeting.participantCount}</td>
                      <td className="px-4 sm:px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium bg-[#F1F5F9] text-[#475569]">
                          {meeting.isHost ? "Host" : "Participant"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
