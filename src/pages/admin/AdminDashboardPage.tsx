import { Users, Video, Globe2, Activity } from "lucide-react"

export function AdminDashboardPage() {
  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card A */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <Users className="h-4 w-4 text-[#3B82F6]" />
            </div>
            <h4 className="text-[14px] font-medium text-[#64748B]">Total Users</h4>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-bold text-[#0F172A] font-display">2,847</span>
          </div>
          <p className="text-[12px] text-[#16A34A] font-medium mt-1">+34 this week</p>
        </div>

        {/* Card B */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
              <Video className="h-4 w-4 text-[#16A34A]" />
            </div>
            <h4 className="text-[14px] font-medium text-[#64748B]">Active Meetings</h4>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-bold text-[#0F172A] font-display">12</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="h-1.5 w-1.5 rounded-full bg-[#0891B2] animate-pulse" />
            <p className="text-[12px] text-[#94A3B8]">Right now</p>
          </div>
        </div>

        {/* Card C */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-[#F3E8FF] flex items-center justify-center">
              <Globe2 className="h-4 w-4 text-[#7C3AED]" />
            </div>
            <h4 className="text-[14px] font-medium text-[#64748B]">Translation Hours</h4>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-bold text-[#0F172A] font-display">4,291</span>
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-1">All time</p>
        </div>

        {/* Card D */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
              <Activity className="h-4 w-4 text-[#D97706]" />
            </div>
            <h4 className="text-[14px] font-medium text-[#64748B]">System Uptime</h4>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-bold text-[#0F172A] font-display">99.8%</span>
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-1">Last 30 days</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Chart (Line) */}
        <div className="w-full lg:w-[60%] bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm min-h-[300px]">
          <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">Daily Meetings (Last 30 Days)</h3>
          
          {/* Mock Line Chart Using CSS */}
          <div className="relative h-[220px] w-full flex items-end">
            <div className="absolute inset-0 flex flex-col justify-between pt-2 pb-6">
              <div className="w-full h-px bg-[#F1F5F9]" />
              <div className="w-full h-px bg-[#F1F5F9]" />
              <div className="w-full h-px bg-[#F1F5F9]" />
              <div className="w-full h-px bg-[#F1F5F9]" />
            </div>
            
            {/* Chart Area */}
            <div className="relative h-full w-full pt-4 pb-6 px-2 flex items-end justify-between z-10">
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M0,80 C20,70 30,90 50,40 C70,0 80,60 100,20 L100,100 L0,100 Z" fill="#EFF6FF" opacity="0.6"/>
                <path d="M0,80 C20,70 30,90 50,40 C70,0 80,60 100,20" fill="none" stroke="#3B82F6" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
              </svg>
            </div>
            
            {/* X-Axis */}
            <div className="absolute bottom-0 inset-x-0 h-6 flex justify-between px-2 text-[11px] text-[#94A3B8]">
              <span>Jun 1</span>
              <span>Jun 8</span>
              <span>Jun 15</span>
              <span>Jun 22</span>
              <span>Jun 30</span>
            </div>
          </div>
        </div>

        {/* Right Chart (Donut) */}
        <div className="w-full lg:w-[40%] bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm min-h-[300px] flex flex-col">
          <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">Language Pairs Used</h3>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            
            {/* Mock Donut Chart via CSS Conic Gradient */}
            <div className="h-40 w-40 rounded-full bg-gray-200 relative mb-6" style={{ background: 'conic-gradient(#3B82F6 0% 48%, #16A34A 48% 79%, #7C3AED 79% 93%, #94A3B8 93% 100%)'}}>
              <div className="absolute inset-[18%] bg-white rounded-full flex flex-col items-center justify-center">
                <span className="text-[20px] font-bold text-[#0F172A]">1.2k</span>
                <span className="text-[11px] text-[#64748B]">Pairs</span>
              </div>
            </div>

            {/* Legend */}
            <div className="w-full grid grid-cols-2 gap-y-3 gap-x-2 px-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-[#3B82F6]" />
                <span className="text-[13px] text-[#64748B]">Urdu↔Chinese (48%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-[#16A34A]" />
                <span className="text-[13px] text-[#64748B]">English↔Urdu (31%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-[#7C3AED]" />
                <span className="text-[13px] text-[#64748B]">English↔Chinese (14%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-[#94A3B8]" />
                <span className="text-[13px] text-[#64748B]">Other (7%)</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
        <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">Recent Activity</h3>
        
        <div className="flex flex-col">
          {[
            { icon: "bg-[#16A34A]", text: "New user registered: Fatima Khan", time: "2 min ago" },
            { icon: "bg-[#3B82F6]", text: "Meeting started: CPEC Review", time: "8 min ago" },
            { icon: "bg-[#DC2626]", text: "Meeting ended: Research Sync", time: "23 min ago" },
            { icon: "bg-[#D97706]", text: "User role updated: Ali Hassan → Admin", time: "1 hr ago" },
            { icon: "bg-[#3B82F6]", text: "3 new meetings created", time: "2 hrs ago" },
          ].map((activity, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors -mx-5 px-5">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${activity.icon}`} />
                <span className="text-[14px] text-[#334155]">{activity.text}</span>
              </div>
              <span className="text-[12px] text-[#94A3B8]">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
