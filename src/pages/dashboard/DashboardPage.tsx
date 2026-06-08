import { Button } from "@/components/ui/Button"
import { useNavigate } from "react-router-dom"
import { useState } from "react"

export function DashboardPage() {
  const navigate = useNavigate()
  const [joinId, setJoinId] = useState("")

  const handleJoin = () => {
    if (joinId.trim()) {
      navigate(`/meeting/room/${joinId.trim()}`)
    }
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      
      {/* Quick Actions Row */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Card 1: New Meeting */}
        <div className="w-full md:w-1/3 bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between items-start gap-4 shadow-sm hover:border-[#3B82F6] transition-colors">
          <div>
            <h3 className="text-[16px] font-semibold text-[#0F172A] font-display">New Meeting</h3>
            <p className="text-[13px] text-[#64748B] mt-1">Start an instant multilingual room</p>
          </div>
          <Button 
            onClick={() => navigate('/meeting/room/intellimeet-xk7a-2b9c')}
            className="bg-[#3B82F6] text-white hover:bg-[#2563EB] h-[36px] px-4 text-[14px] rounded-lg border-0"
          >
            Start Now
          </Button>
        </div>

        {/* Card 2: Join Meeting */}
        <div className="w-full md:w-2/3 bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between shadow-sm hover:border-[#3B82F6] transition-colors">
          <div className="mb-4">
            <h3 className="text-[16px] font-semibold text-[#0F172A] font-display">Join a Meeting</h3>
            <p className="text-[13px] text-[#64748B] mt-1">Enter a meeting ID or paste a link</p>
          </div>
          <div className="flex gap-2 w-full max-w-md">
            <input 
              type="text" 
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="Enter meeting ID (e.g. intellimeet-xk7a-2b9c)" 
              className="flex-1 h-[40px] px-3 bg-white border border-[#E2E8F0] rounded-lg text-[14px] text-[#0F172A] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/10 transition-all placeholder:text-[#94A3B8]"
            />
            <Button 
              onClick={handleJoin}
              disabled={!joinId.trim()}
              className="bg-[#3B82F6] text-white hover:bg-[#2563EB] disabled:opacity-50 h-[40px] px-6 text-[14px] rounded-lg border-0"
            >
              Join
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Meetings Hosted", value: "12", sub: "this month" },
          { title: "Hours Connected", value: "8.4", sub: "this month" },
          { title: "Languages Used", value: "3", sub: "Urdu, Chinese, English" },
          { title: "Participants Reached", value: "47", sub: "all time" },
        ].map((stat) => (
          <div key={stat.title} className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
            <h4 className="text-[13px] font-medium text-[#64748B] mb-2">{stat.title}</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-bold text-[#0F172A] font-display">{stat.value}</span>
            </div>
            <p className="text-[12px] text-[#94A3B8] mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent Meetings Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[16px] font-semibold text-[#0F172A] font-display">Recent Meetings</h2>
          <a href="#" className="text-[13px] font-medium text-[#3B82F6] hover:text-[#2563EB]">View all &rarr;</a>
        </div>
        
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Meeting Title</th>
                <th className="px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider hidden sm:table-cell">Language Pair</th>
                <th className="px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider hidden md:table-cell">Date</th>
                <th className="px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider hidden lg:table-cell">Duration</th>
                <th className="px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider hidden sm:table-cell">Participants</th>
                <th className="px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {[
                { title: "CPEC Quarterly Review", lang: "🇵🇰→🇨🇳 Urdu-Chinese", date: "Jun 5, 2026", dur: "1h 12m", pax: "8" },
                { title: "Research Sync — FAST", lang: "🇬🇧→🇵🇰 English-Urdu", date: "Jun 3, 2026", dur: "45m", pax: "4" },
                { title: "Team Standup", lang: "🇵🇰→🇨🇳 Urdu-Chinese", date: "Jun 1, 2026", dur: "22m", pax: "3" },
              ].map((meeting, i) => (
                <tr key={i} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-5 py-4 text-[14px] font-medium text-[#0F172A]">{meeting.title}</td>
                  <td className="px-5 py-4 text-[14px] text-[#64748B] hidden sm:table-cell">{meeting.lang}</td>
                  <td className="px-5 py-4 text-[14px] text-[#64748B] hidden md:table-cell">{meeting.date}</td>
                  <td className="px-5 py-4 text-[14px] text-[#64748B] hidden lg:table-cell">{meeting.dur}</td>
                  <td className="px-5 py-4 text-[14px] text-[#64748B] hidden sm:table-cell">{meeting.pax}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium bg-[#16A34A]/10 text-[#16A34A]">
                      Completed
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <a href="#" className="text-[13px] font-medium text-[#3B82F6] hover:text-[#2563EB]">View Summary</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  )
}
