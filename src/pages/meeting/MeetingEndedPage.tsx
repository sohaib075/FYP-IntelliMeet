import { Link } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { PhoneOff } from "lucide-react"

export function MeetingEndedPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-body">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
        <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <PhoneOff className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-[#0F172A] font-display mb-2">Meeting Ended</h2>
        <p className="text-[15px] text-[#64748B] mb-8 leading-relaxed">
          This meeting has been ended by the host. Thank you for using IntelliMeet.
        </p>
        <div className="flex flex-col gap-3">
          <Link to="/dashboard">
            <Button size="lg" className="w-full bg-[#3B82F6] text-white hover:bg-[#2563EB]">
              Go to Dashboard
            </Button>
          </Link>
          <Link to="/">
            <Button variant="ghost" className="w-full text-[#64748B] hover:text-[#0F172A]">
              Return to Homepage
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
