import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts"

export function AdminAnalyticsPage() {
  const translationLatency = [
    { time: "00:00", latency: 1.2 },
    { time: "04:00", latency: 1.1 },
    { time: "08:00", latency: 1.8 },
    { time: "12:00", latency: 2.4 },
    { time: "16:00", latency: 2.1 },
    { time: "20:00", latency: 1.5 },
  ]

  const errorsLogged = [
    { date: "Oct 06", errors: 12 },
    { date: "Oct 07", errors: 8 },
    { date: "Oct 08", errors: 15 },
    { date: "Oct 09", errors: 5 },
    { date: "Oct 10", errors: 2 },
    { date: "Oct 11", errors: 4 },
    { date: "Oct 12", errors: 1 },
  ]

  const languagePairs = [
    { name: "Urdu-Chinese", value: 45 },
    { name: "English-Urdu", value: 30 },
    { name: "English-Chinese", value: 20 },
    { name: "Other", value: 5 },
  ]
  const COLORS = ["#06B6D4", "#3B82F6", "#8B5CF6", "#F59E0B"]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight text-white">Analytics & Reports</h1>
        <p className="text-gray-400 mt-1">Deep dive into platform performance and usage metrics.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Translation Latency */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Average Translation Latency (s)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={translationLatency}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                  <XAxis dataKey="time" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" domain={[0, 3]} />
                  <Tooltip contentStyle={{ backgroundColor: "#161D35", border: "1px solid #1E3A5F" }} />
                  <Line type="monotone" dataKey="latency" stroke="#06B6D4" strokeWidth={3} dot={{ fill: "#3B82F6" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Translation Success Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Translation Success</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[300px]">
            <div className="text-6xl font-bold font-display text-green-500 mb-2">99.2%</div>
            <p className="text-gray-400 text-center">Translation requests successfully processed today.</p>
          </CardContent>
        </Card>

        {/* Errors Logged */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Translation Errors Logged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={errorsLogged}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
                  <XAxis dataKey="date" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: "#161D35", border: "1px solid #1E3A5F" }} />
                  <Bar dataKey="errors" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Language Pairs Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Language Pair Distribution (%)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={languagePairs}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {languagePairs.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#161D35", border: "1px solid #1E3A5F" }} formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 w-full">
              {languagePairs.map((pair, i) => (
                <div key={i} className="flex items-center text-xs text-gray-400">
                  <span className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: COLORS[i] }} />
                  {pair.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
