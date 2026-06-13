import { useState } from "react"
import { GoogleLogin } from "@react-oauth/google"
import { useNavigate } from "react-router-dom"
import { useAuthStore, mapBackendUser } from "@/store/useAuthStore"
import { authApi, ApiError } from "@/lib/api"

interface GoogleAuthButtonProps {
  onError?: (msg: string) => void
}

export function GoogleAuthButton({ onError }: GoogleAuthButtonProps) {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [isLoading, setIsLoading] = useState(false)

  const handleSuccess = async (credentialResponse: any) => {
    setIsLoading(true)
    try {
      const token = credentialResponse.credential
      if (!token) throw new Error("No credential received")
      
      const data = await authApi.googleAuth(token)
      const mappedUser = mapBackendUser(data.user)
      login(data.token, mappedUser)
      navigate('/dashboard')
    } catch (err) {
      console.error("[GoogleAuthButton] Authentication error:", err)
      if (err instanceof ApiError) {
        onError?.(err.message)
      } else {
        onError?.("Google authentication failed. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`w-full flex justify-center [&>div]:w-full ${isLoading ? "opacity-50 pointer-events-none" : ""}`}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError?.("Google login popup closed or failed.")}
        theme="outline"
        size="large"
        width="380px"
        text="continue_with"
      />
    </div>
  )
}
