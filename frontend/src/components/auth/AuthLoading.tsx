import { Logo } from "@/components/common/Logo"

/**
 * Shown while a restored session is being confirmed with the server.
 *
 * Deliberately neutral: it must not look like either the dashboard or the
 * login page, because at this moment the app genuinely does not know which
 * one the user is entitled to see.
 */
export function AuthLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-[#F8FAFC] px-6"
    >
      <Logo size={44} className="text-[#3B82F6]" />
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-[#CBD5E1] border-t-[#3B82F6]"
        aria-hidden="true"
      />
      <span className="sr-only">Checking your session…</span>
    </div>
  )
}
