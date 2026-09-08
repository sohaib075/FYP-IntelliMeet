import { Link, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { PhoneOff, UserX, MonitorSmartphone } from "lucide-react"

const COPY: Record<string, { title: string; body: string; icon: "ended" | "removed" | "duplicate" }> = {
  ended: {
    title: "Meeting Ended",
    body: "This meeting has been ended by the host. Thank you for using IntelliMeet.",
    icon: "ended",
  },
  left: {
    title: "You left the meeting",
    body: "The meeting is still running for the other participants. You can rejoin from your dashboard while it's active.",
    icon: "ended",
  },
  removed: {
    title: "You were removed",
    body: "The host removed you from this meeting.",
    icon: "removed",
  },
  "removed-blocked": {
    title: "You were removed",
    body: "The host removed you from this meeting and blocked you from rejoining.",
    icon: "removed",
  },
  duplicate: {
    title: "Joined from another tab",
    body: "You opened this meeting somewhere else, so this tab was disconnected. The other tab is still in the meeting.",
    icon: "duplicate",
  },
}

export function MeetingEndedPage() {
  const [params] = useSearchParams()
  const reason = params.get("reason") || "ended"
  const copy = COPY[reason] || COPY.ended
  const Icon = copy.icon === "removed" ? UserX : copy.icon === "duplicate" ? MonitorSmartphone : PhoneOff

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-body">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-lg">
        <div className="h-16 w-16 sm:h-20 sm:w-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-red-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-display mb-2 break-words">{copy.title}</h2>
        <p className="text-[15px] text-[#64748B] mb-6 sm:mb-8 leading-relaxed break-words">{copy.body}</p>
        <div className="flex flex-col gap-3">
          <Link to="/dashboard" className="w-full">
            <Button size="lg" className="w-full bg-[#3B82F6] text-white hover:bg-[#2563EB]">
              Go to Dashboard
            </Button>
          </Link>
          <Link to="/" className="w-full">
            <Button variant="ghost" className="w-full h-11 sm:h-10 text-[#64748B] hover:text-[#0F172A]">
              Return to Homepage
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
