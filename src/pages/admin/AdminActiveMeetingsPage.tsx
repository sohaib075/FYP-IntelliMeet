import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Video, PowerOff, XCircle, Users } from "lucide-react"

export function AdminActiveMeetingsPage() {
  const activeMeetings = [
    { id: "im-1111", title: "Quarterly Review", host: "Admin User", startTime: "10:00 AM", duration: "45m", participants: 12, langs: ["EN", "ZH"] },
    { id: "im-2222", title: "Project Sync", host: "Sarah Smith", startTime: "10:30 AM", duration: "15m", participants: 4, langs: ["UR", "EN"] },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-white">Active Meetings Monitor</h1>
          <p className="text-gray-400 mt-1">Real-time view of all ongoing meetings.</p>
        </div>
        <div className="bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full border border-green-500/30 flex items-center gap-2 text-sm font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Live Monitoring
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {activeMeetings.map((meeting) => (
          <Card key={meeting.id} className="border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <CardHeader className="pb-3 border-b border-[#1E3A5F]">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{meeting.title}</CardTitle>
                  <p className="text-xs font-mono text-gray-400 mt-1">{meeting.id}</p>
                </div>
                <Badge variant="active" className="animate-pulse">Live {meeting.duration}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Host</p>
                  <div className="flex items-center gap-2">
                    <Avatar fallback={meeting.host} size="sm" />
                    <span className="text-white truncate">{meeting.host}</span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Participants</p>
                  <div className="flex items-center gap-2 text-white">
                    <Users className="h-4 w-4 text-[#3B82F6]" />
                    {meeting.participants} Active
                  </div>
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-1.5">Language Pairs</p>
                <div className="flex gap-2">
                  {meeting.langs.map(l => <Badge key={l} variant="language">{l}</Badge>)}
                </div>
              </div>

              <div className="pt-4 border-t border-[#1E3A5F] flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1">
                  View Details
                </Button>
                <Button variant="danger" size="sm" className="flex-1">
                  <PowerOff className="h-4 w-4 mr-2" /> Force End
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {activeMeetings.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400">
            <Video className="h-12 w-12 mx-auto mb-4 opacity-50 text-gray-500" />
            <p>No active meetings right now.</p>
          </div>
        )}
      </div>
    </div>
  )
}
