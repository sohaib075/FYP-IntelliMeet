import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card"
import { Video, ArrowRight } from "lucide-react"
import { meetingApi, describeApiError } from "@/lib/api"
import { normalizeMeetingId } from "@/lib/meetingId"

export function JoinMeetingPage() {
  const [meetingId, setMeetingId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!meetingId.trim()) {
      setError("Meeting code is required.")
      return
    }

    // Accept a bare code, a spaced/uppercased code, or a pasted invite link
    const normalized = normalizeMeetingId(meetingId)
    if (!normalized) {
      setError("That doesn't look like a meeting code. Codes look like abc-defg-hij.")
      return
    }

    setIsLoading(true)
    try {
      // The server is the only authority on whether a meeting exists.
      // A wrong code is an error here — it never creates a meeting.
      const { meeting } = await meetingApi.get(normalized)
      if (meeting.status === "ENDED") {
        setError("This meeting has ended.")
        return
      }
      navigate(`/meet/${meeting.meetingId}`)
    } catch (err) {
      setError(describeApiError(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 p-4 sm:p-8 min-h-[calc(100vh-160px)] flex flex-col justify-center">
      <Card className="w-full shadow-xl">
        <CardHeader className="text-center p-4 pb-4 sm:p-6 sm:pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF] text-[#3B82F6]">
            <Video className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-display">Join Meeting</CardTitle>
          <CardDescription>Enter a meeting code or paste an invite link.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {error && (
            <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-[14px] text-red-600 text-center break-words">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-6">
            <Input
              placeholder="e.g. abc-defg-hij"
              aria-label="Meeting code"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
              spellCheck={false}
              className="text-center text-lg py-6 font-mono tracking-wider"
            />
            <Button type="submit" className="w-full bg-[#3B82F6] text-white hover:bg-[#2563EB] h-12 text-[15px]" size="lg" isLoading={isLoading}>
              {isLoading ? "Checking meeting..." : "Join Meeting"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
