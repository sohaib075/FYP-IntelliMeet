import { Link } from "react-router-dom"
import { Calendar, Link as LinkIcon, PhoneOff, AlertTriangle, X } from "lucide-react"

export function StatusPreviewPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-body p-8 space-y-12">
      
      <div className="max-w-[1000px] mx-auto">
        <h1 className="text-[28px] font-bold text-[#0F172A] font-display mb-2">Error & Empty States Reference</h1>
        <p className="text-[#64748B] mb-8">Screen 15 from IntelliMeet Design System</p>
        
        <div className="space-y-12">
          
          {/* STATE 1 - Empty Meetings Dashboard */}
          <div>
            <h2 className="text-[14px] font-semibold text-[#64748B] tracking-[1px] uppercase mb-4">State 1 — Empty Meetings Dashboard</h2>
            <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-12 flex flex-col items-center justify-center text-center shadow-sm max-w-[600px] mx-auto">
              <div className="h-20 w-20 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-6">
                <Calendar className="h-8 w-8 text-[#94A3B8]" />
              </div>
              <h3 className="text-[18px] font-medium text-[#0F172A] mb-2">No meetings yet</h3>
              <p className="text-[14px] text-[#64748B] mb-6 max-w-[280px]">
                Create your first multilingual meeting to get started.
              </p>
              <button className="h-10 px-6 bg-[#2563EB] text-white text-[14px] font-medium rounded-[8px] hover:bg-[#1D4ED8] transition-colors">
                Create Meeting
              </button>
            </div>
          </div>

          {/* STATE 2 - Meeting Not Found Error */}
          <div>
            <h2 className="text-[14px] font-semibold text-[#64748B] tracking-[1px] uppercase mb-4">State 2 — Meeting Not Found Error</h2>
            <div className="bg-white border border-[#FCA5A5] rounded-[16px] p-8 flex flex-col items-center text-center shadow-sm max-w-[480px] mx-auto relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-[#DC2626]" />
              <div className="h-12 w-12 rounded-full bg-[#FEE2E2] flex items-center justify-center mb-4">
                <LinkIcon className="h-6 w-6 text-[#DC2626]" />
              </div>
              <h3 className="text-[18px] font-medium text-[#0F172A] mb-3">Meeting Not Found</h3>
              <p className="text-[14px] text-[#64748B] mb-6 max-w-[320px] leading-[1.6]">
                The meeting ID you entered doesn't exist or has already ended. Please check the ID and try again.
              </p>
              <div className="w-full flex items-center gap-2 mb-4">
                <input 
                  type="text" 
                  placeholder="Try another meeting ID" 
                  className="flex-1 h-10 px-3 bg-white border border-[#E2E8F0] rounded-[8px] text-[14px]"
                />
                <button className="h-10 px-4 bg-[#2563EB] text-white text-[14px] font-medium rounded-[8px] hover:bg-[#1D4ED8] transition-colors shrink-0">
                  Join
                </button>
              </div>
              <Link to="/dashboard" className="text-[13px] font-medium text-[#2563EB] hover:underline">
                ← Back to Dashboard
              </Link>
            </div>
          </div>

          {/* STATE 3 - Meeting Ended */}
          <div>
            <h2 className="text-[14px] font-semibold text-[#64748B] tracking-[1px] uppercase mb-4">State 3 — Meeting Ended (Participant View)</h2>
            <div className="bg-[#0D1117] rounded-[16px] p-12 flex flex-col items-center justify-center shadow-lg border border-[#21262D]">
              <div className="bg-white rounded-[16px] w-full max-w-[480px] p-8 text-center shadow-2xl relative overflow-hidden">
                <div className="h-12 w-12 mx-auto rounded-full bg-[#F1F5F9] flex items-center justify-center mb-5">
                  <PhoneOff className="h-6 w-6 text-[#64748B]" />
                </div>
                <h3 className="text-[20px] font-semibold text-[#0F172A] mb-2">The meeting has ended</h3>
                <p className="text-[14px] text-[#64748B] mb-6">Muhammad Usman ended the meeting.</p>
                
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] py-3 flex justify-center gap-8 mb-6">
                  <div>
                    <div className="text-[12px] text-[#64748B]">Duration</div>
                    <div className="text-[14px] font-medium text-[#0F172A]">1h 12m</div>
                  </div>
                  <div className="w-[1px] bg-[#E2E8F0]" />
                  <div>
                    <div className="text-[12px] text-[#64748B]">Participants</div>
                    <div className="text-[14px] font-medium text-[#0F172A]">8</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button className="w-full h-10 flex items-center justify-center bg-[#2563EB] text-white text-[14px] font-medium rounded-[8px] hover:bg-[#1D4ED8] transition-colors">
                    View Meeting Summary
                  </button>
                  <button className="w-full h-10 flex items-center justify-center bg-white border border-[#E2E8F0] text-[#0F172A] text-[14px] font-medium rounded-[8px] hover:bg-[#F8FAFC] transition-colors">
                    Return to Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* STATE 4 - Translation Error Toast */}
          <div>
            <h2 className="text-[14px] font-semibold text-[#64748B] tracking-[1px] uppercase mb-4">State 4 — Translation Error Toast</h2>
            <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-12 relative h-[200px] overflow-hidden flex items-end justify-end shadow-sm">
              <div className="bg-[#FEF3C7] border-l-[4px] border-l-[#D97706] rounded-[8px] w-[340px] shadow-lg relative overflow-hidden">
                <div className="p-4 flex gap-3 relative z-10">
                  <AlertTriangle className="h-5 w-5 text-[#D97706] shrink-0" />
                  <div className="flex-1 pr-6">
                    <p className="text-[14px] text-[#92400E] leading-[1.5]">
                      Translation temporarily unavailable. Reconnecting...
                    </p>
                  </div>
                  <button className="absolute top-4 right-4 text-[#B45309] hover:text-[#78350F]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Progress Bar Mock */}
                <div className="absolute bottom-0 left-0 h-1 bg-[#F59E0B] w-[40%] animate-pulse" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
