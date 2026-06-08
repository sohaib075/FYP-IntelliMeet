import { useState } from "react"
import { Search, MoreHorizontal, Plus } from "lucide-react"

export function AdminUsersPage() {
  const users = [
    { id: 1, name: "Muhammad Usman", email: "musman@fast.edu.pk", init: "MU", bg: "bg-[#3B82F6]", role: "Host", roleColor: "bg-[#EFF6FF] text-[#3B82F6]", lang: "🇵🇰 → 🇨🇳", meetings: 12, lastActive: "2 hrs ago", status: "Active", statusColor: "bg-[#F0FDF4] text-[#16A34A]" },
    { id: 2, name: "Ibrahim Zahid", email: "ibrahim@fast.edu.pk", init: "IZ", bg: "bg-[#16A34A]", role: "Host", roleColor: "bg-[#EFF6FF] text-[#3B82F6]", lang: "🇨🇳 → 🇵🇰", meetings: 8, lastActive: "1 day ago", status: "Active", statusColor: "bg-[#F0FDF4] text-[#16A34A]" },
    { id: 3, name: "Fatima Khan", email: "fatima@gmail.com", init: "FK", bg: "bg-[#7C3AED]", role: "Participant", roleColor: "bg-[#F1F5F9] text-[#64748B]", lang: "🇬🇧 → 🇵🇰", meetings: 3, lastActive: "Just now", status: "Active", statusColor: "bg-[#F0FDF4] text-[#16A34A]" },
    { id: 4, name: "Ali Hassan", email: "ali@intellimeet.com", init: "AH", bg: "bg-[#D97706]", role: "Admin", roleColor: "bg-[#FEF2F2] text-[#DC2626]", lang: "--", meetings: 0, lastActive: "3 days ago", status: "Active", statusColor: "bg-[#F0FDF4] text-[#16A34A]" },
    { id: 5, name: "Unknown User", email: "unknown@example.com", init: "UU", bg: "bg-[#64748B]", role: "Participant", roleColor: "bg-[#F1F5F9] text-[#64748B]", lang: "--", meetings: 1, lastActive: "30 days ago", status: "Suspended", statusColor: "bg-[#FEF2F2] text-[#DC2626]" },
  ]

  const [searchTerm, setSearchTerm] = useState("")

  return (
    <div className="p-6 max-w-[1200px] mx-auto bg-[#F8FAFC] min-h-full font-body">
      
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0F172A] font-display leading-[1.2]">User Management</h1>
          <p className="text-[14px] text-[#64748B]">2,847 total users</p>
        </div>
      </div>

      {/* Filter / Action Row */}
      <div className="mb-5 flex flex-col lg:flex-row justify-between items-center gap-4">
        
        {/* Search */}
        <div className="relative w-full lg:w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-white border border-[#E2E8F0] rounded-[8px] text-[14px] text-[#0F172A] focus:outline-none focus:border-[#3B82F6] shadow-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-[140px]">
            <select className="w-full h-10 px-3 bg-white border border-[#E2E8F0] rounded-[8px] text-[14px] text-[#0F172A] appearance-none focus:outline-none focus:border-[#3B82F6] shadow-sm">
              <option>All Roles</option>
              <option>Host</option>
              <option>Participant</option>
              <option>Admin</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          
          <div className="relative flex-1 lg:w-[140px]">
            <select className="w-full h-10 px-3 bg-white border border-[#E2E8F0] rounded-[8px] text-[14px] text-[#0F172A] appearance-none focus:outline-none focus:border-[#3B82F6] shadow-sm">
              <option>All Status</option>
              <option>Active</option>
              <option>Suspended</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          <button className="h-10 px-4 bg-[#3B82F6] text-white text-[14px] font-medium rounded-[8px] flex items-center gap-2 hover:bg-[#2563EB] transition-colors shadow-sm whitespace-nowrap shrink-0">
            <Plus className="h-4 w-4" /> Add User
          </button>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr>
                <th className="h-10 px-4 text-[12px] font-medium text-[#64748B] uppercase tracking-[1px] whitespace-nowrap w-[40px]">
                  <input type="checkbox" className="rounded border-[#E2E8F0] text-[#3B82F6]" />
                </th>
                <th className="h-10 px-4 text-[12px] font-medium text-[#64748B] uppercase tracking-[1px] whitespace-nowrap">User</th>
                <th className="h-10 px-4 text-[12px] font-medium text-[#64748B] uppercase tracking-[1px] whitespace-nowrap">Role</th>
                <th className="h-10 px-4 text-[12px] font-medium text-[#64748B] uppercase tracking-[1px] whitespace-nowrap">Language</th>
                <th className="h-10 px-4 text-[12px] font-medium text-[#64748B] uppercase tracking-[1px] whitespace-nowrap">Meetings</th>
                <th className="h-10 px-4 text-[12px] font-medium text-[#64748B] uppercase tracking-[1px] whitespace-nowrap">Last Active</th>
                <th className="h-10 px-4 text-[12px] font-medium text-[#64748B] uppercase tracking-[1px] whitespace-nowrap">Status</th>
                <th className="h-10 px-4 text-[12px] font-medium text-[#64748B] uppercase tracking-[1px] whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="h-[44px] border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4">
                    <input type="checkbox" className="rounded border-[#E2E8F0] text-[#3B82F6]" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full ${user.bg} flex items-center justify-center text-white text-[12px] font-medium shrink-0`}>
                        {user.init}
                      </div>
                      <div>
                        <div className="text-[14px] font-medium text-[#0F172A]">{user.name}</div>
                        <div className="text-[13px] text-[#64748B]">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4">
                    <span className={`px-2 py-0.5 rounded-[6px] text-[12px] font-medium ${user.roleColor}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 text-[13px] text-[#0F172A]">{user.lang}</td>
                  <td className="px-4 text-[13px] text-[#0F172A]">{user.meetings}</td>
                  <td className="px-4 text-[13px] text-[#64748B]">{user.lastActive}</td>
                  <td className="px-4">
                    <span className={`px-2 py-0.5 rounded-[6px] text-[12px] font-medium ${user.statusColor}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 text-right">
                    <button className="h-8 w-8 inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] rounded-[6px] transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[13px] text-[#64748B]">Showing 1-5 of 2,847 users</span>
        <div className="flex items-center gap-1">
          <button className="h-8 px-3 flex items-center justify-center text-[13px] font-medium text-[#64748B] border border-[#E2E8F0] bg-white rounded-[6px] hover:bg-[#F8FAFC]">Previous</button>
          <button className="h-8 w-8 flex items-center justify-center text-[13px] font-medium text-white bg-[#3B82F6] rounded-[6px]">1</button>
          <button className="h-8 w-8 flex items-center justify-center text-[13px] font-medium text-[#0F172A] hover:bg-[#E2E8F0] rounded-[6px]">2</button>
          <button className="h-8 w-8 flex items-center justify-center text-[13px] font-medium text-[#0F172A] hover:bg-[#E2E8F0] rounded-[6px]">3</button>
          <span className="text-[#94A3B8] px-1">...</span>
          <button className="h-8 w-8 flex items-center justify-center text-[13px] font-medium text-[#0F172A] hover:bg-[#E2E8F0] rounded-[6px]">570</button>
          <button className="h-8 px-3 flex items-center justify-center text-[13px] font-medium text-[#64748B] border border-[#E2E8F0] bg-white rounded-[6px] hover:bg-[#F8FAFC]">Next</button>
        </div>
      </div>

    </div>
  )
}
