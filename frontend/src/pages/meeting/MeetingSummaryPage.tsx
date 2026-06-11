import { useState } from "react"
import { Link } from "react-router-dom"
import { Calendar, Clock, Users, Globe2, FileText, CheckSquare, ChevronDown, Download, Copy } from "lucide-react"

export function MeetingSummaryPage() {
  const [transcriptionOpen, setTranscriptionOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-body p-6">
      <div className="max-w-[800px] mx-auto">
        
        {/* Header */}
        <div className="mb-6 flex items-center gap-2">
          <span className="text-[16px] font-bold text-[#0F172A] font-display">IntelliMeet</span>
          <span className="text-[#94A3B8] text-[14px]">/</span>
          <span className="text-[#64748B] text-[14px]">Dashboard</span>
          <span className="text-[#94A3B8] text-[14px]">/</span>
          <span className="text-[#0F172A] text-[14px] font-medium">Meeting Summary</span>
        </div>

        {/* Meeting Overview Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4 shadow-sm">
          <div>
            <h1 className="text-[22px] font-semibold text-[#0F172A] mb-4">CPEC Quarterly Review</h1>
            <div className="space-y-2 text-[14px] text-[#64748B]">
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-[#94A3B8]" /> June 5, 2026, 10:00 AM</div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-[#94A3B8]" /> Duration: 1 hour 12 minutes</div>
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#94A3B8]" /> 8 participants</div>
              <div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-[#94A3B8]" /> Languages: 🇵🇰 Urdu ↔ 🇨🇳 Chinese</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="bg-[#16A34A] text-white text-[12px] font-medium px-2.5 py-1 rounded-[8px]">Completed</span>
            <span className="bg-[#EFF6FF] text-[#3B82F6] text-[12px] font-medium px-2.5 py-1 rounded-[8px]">AI Summary Available</span>
          </div>
        </div>

        {/* AI Summary Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-5 w-5 text-[#0F172A]" />
            <h2 className="text-[16px] font-semibold text-[#0F172A]">Meeting Summary</h2>
            <span className="bg-[#EFF6FF] text-[#3B82F6] text-[11px] font-medium px-2 py-0.5 rounded-full ml-2">AI Generated</span>
          </div>
          <p className="text-[15px] text-[#374151] leading-[1.7]">
            The team reviewed Q3 revenue projections for the CPEC infrastructure corridor project. Ibrahim Zahid presented growth metrics showing a 23% increase in cross-border transactions. Key discussion focused on timeline adjustments for Phase 2 deliverables. The team aligned on budget allocation priorities for Q4.
          </p>
        </div>

        {/* Action Items Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <CheckSquare className="h-5 w-5 text-[#0F172A]" />
            <h2 className="text-[16px] font-semibold text-[#0F172A]">Action Items (3)</h2>
          </div>
          <div className="space-y-4">
            {[
              { task: "Finalize Phase 2 timeline document", owner: "Ibrahim Zahid", time: "Mentioned at 00:34:12" },
              { task: "Send Q3 revenue report to management", owner: "Muhammad Usman", time: "00:51:08" },
              { task: "Schedule follow-up for Phase 3 review", owner: "Muhammad Sohaib", time: "01:02:44" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 rounded border-[#E2E8F0] text-[#3B82F6]" />
                <div className="flex-1">
                  <p className="text-[15px] text-[#0F172A] mb-1">{item.task}</p>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#EFF6FF] text-[#3B82F6] text-[12px] px-2 py-0.5 rounded-full">{item.owner}</span>
                    <span className="text-[12px] text-[#94A3B8]">{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transcription Section */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] mb-6 shadow-sm overflow-hidden">
          <button 
            onClick={() => setTranscriptionOpen(!transcriptionOpen)}
            className="w-full flex items-center justify-between p-6 hover:bg-[#F8FAFC] transition-colors"
          >
            <span className="text-[15px] font-semibold text-[#0F172A]">Full Transcription</span>
            <div className="flex items-center gap-3">
              <span className="hidden sm:flex items-center gap-1 text-[13px] text-[#64748B] border border-[#E2E8F0] px-3 py-1 rounded-[6px] hover:bg-white bg-[#F8FAFC]">
                <Download className="h-3 w-3" /> Download
              </span>
              <ChevronDown className={`h-5 w-5 text-[#94A3B8] transition-transform ${transcriptionOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>
          
          {transcriptionOpen && (
            <div className="px-6 pb-6 pt-2 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="space-y-4 font-mono text-[13px]">
                <div className="flex gap-4 text-[#374151]">
                  <span className="text-[#94A3B8] shrink-0">[00:00:12]</span>
                  <div>
                    <span className="font-semibold text-[#0F172A]">Muhammad Usman:</span> "Let's begin with the Q3 overview..."
                  </div>
                </div>
                <div className="flex gap-4 text-[#374151]">
                  <span className="text-[#94A3B8] shrink-0">[00:00:45]</span>
                  <div>
                    <span className="font-semibold text-[#0F172A]">Ibrahim Zahid:</span> <span className="text-[#64748B]">(translated from Chinese)</span> "The numbers show strong growth..."
                  </div>
                </div>
                <div className="pt-4 text-center">
                  <a href="#" className="text-[#3B82F6] font-sans text-[13px] hover:underline">Show all 847 lines</a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Download Row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button className="flex-1 h-9 flex items-center justify-center gap-2 bg-white border border-[#E2E8F0] rounded-[8px] text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] transition-colors shadow-sm">
            <Download className="h-4 w-4 text-[#64748B]" /> Download Summary PDF
          </button>
          <button className="flex-1 h-9 flex items-center justify-center gap-2 bg-white border border-[#E2E8F0] rounded-[8px] text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] transition-colors shadow-sm">
            <Download className="h-4 w-4 text-[#64748B]" /> Download Transcription
          </button>
          <button className="flex-1 h-9 flex items-center justify-center gap-2 bg-white border border-[#E2E8F0] rounded-[8px] text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] transition-colors shadow-sm">
            <Copy className="h-4 w-4 text-[#64748B]" /> Copy Meeting Link
          </button>
        </div>

        {/* Footer Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E2E8F0]">
          <Link to="/dashboard" className="h-10 px-4 flex items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-white text-[#0F172A] text-[14px] font-medium hover:bg-[#F8FAFC] transition-colors shadow-sm">
            Back to Dashboard
          </Link>
          <Link to="/meeting/create" className="h-10 px-4 flex items-center justify-center rounded-[8px] bg-[#3B82F6] text-white text-[14px] font-medium hover:bg-[#2563EB] transition-colors shadow-sm">
            Start New Meeting
          </Link>
        </div>

      </div>
    </div>
  )
}
