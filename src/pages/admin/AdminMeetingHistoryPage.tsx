import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Search, Download, Trash2, FileText, Calendar } from "lucide-react"

export function AdminMeetingHistoryPage() {
  const history = [
    { id: "im-1234", title: "Quarterly Review", host: "Admin User", date: "Oct 12, 2026", duration: "45m", participants: 12, langs: "EN, ZH", status: "Completed" },
    { id: "im-5678", title: "Project Sync", host: "John Doe", date: "Oct 11, 2026", duration: "30m", participants: 4, langs: "UR, EN", status: "Completed" },
    { id: "im-9012", title: "Client Pitch", host: "Sarah Smith", date: "Oct 10, 2026", duration: "1h 10m", participants: 8, langs: "ZH, UR", status: "Force-Ended" },
    { id: "im-3456", title: "Quick Catchup", host: "Li Wei", date: "Oct 09, 2026", duration: "15m", participants: 2, langs: "ZH, EN", status: "Abandoned" },
  ]

  const [searchTerm, setSearchTerm] = useState("")

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-white">Meeting History</h1>
          <p className="text-gray-400 mt-1">Review past meetings and download records.</p>
        </div>
        <Button variant="secondary">
          <Download className="mr-2 h-4 w-4" /> Export as CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-4 justify-between items-center pb-2">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search host or title"
                icon={<Search className="h-4 w-4" />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-32 hidden sm:block">
              <Select defaultValue="all">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32 hidden md:block">
              <Select defaultValue="all">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="forced">Force-Ended</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-[#1E2847] border-y border-[#1E3A5F]">
                <tr>
                  <th className="px-4 py-3">Meeting Title</th>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Date & Duration</th>
                  <th className="px-4 py-3">Participants</th>
                  <th className="px-4 py-3">Langs</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((meeting) => (
                  <tr key={meeting.id} className="border-b border-[#1E3A5F] hover:bg-[#1E2847]/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{meeting.title}</p>
                      <p className="text-xs font-mono text-gray-500">{meeting.id}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{meeting.host}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300">{meeting.date}</p>
                      <p className="text-xs text-gray-500">{meeting.duration}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{meeting.participants}</td>
                    <td className="px-4 py-3 text-gray-300">{meeting.langs}</td>
                    <td className="px-4 py-3">
                      <Badge variant={meeting.status === "Completed" ? "active" : meeting.status === "Force-Ended" ? "error" : "default"}>
                        {meeting.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" title="View Summary" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete Record" className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
