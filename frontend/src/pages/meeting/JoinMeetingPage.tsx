import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card"
import { Video, ArrowRight } from "lucide-react"

export function JoinMeetingPage() {
  const [meetingId, setMeetingId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!meetingId.trim()) {
      setError("Meeting ID is required.")
      return
    }

    // Basic smart parsing: extract ID if full URL is pasted
    let parsedId = meetingId.trim()
    if (parsedId.includes("intellimeet.app/join/")) {
      parsedId = parsedId.split("intellimeet.app/join/")[1]
    }

    // Basic validation format check
    if (parsedId.length < 5) {
      setError("Meeting not found. Please check the ID and try again.")
      return
    }

    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      // Navigate to lobby
      navigate(`/meeting/lobby/${parsedId}`)
    }, 1500)
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 p-8 min-h-[calc(100vh-160px)] flex flex-col justify-center">
      <Card className="w-full shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF] text-[#3B82F6]">
            <Video className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-display">Join Meeting</CardTitle>
          <CardDescription>Enter a meeting ID or link to join.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-[14px] text-red-600 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-6">
            <Input
              placeholder="e.g. im-1234-abcd or https://..."
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              disabled={isLoading}
              className="text-center text-lg py-6"
            />
            <Button type="submit" className="w-full bg-[#3B82F6] text-white hover:bg-[#2563EB] h-12 text-[15px]" size="lg" isLoading={isLoading}>
              {isLoading ? "Verifying meeting..." : "Join Meeting"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
