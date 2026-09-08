import { Routes, Route, Navigate } from "react-router-dom"

// Layouts
import { PublicLayout } from "./layouts/PublicLayout"
import { DashboardLayout } from "./layouts/DashboardLayout"

import { ProtectedRoute } from "./components/auth/ProtectedRoute"
import { PublicOnlyRoute } from "./components/auth/PublicOnlyRoute"
import { useSessionBootstrap } from "./components/auth/useSessionBootstrap"
import { ScrollToTop } from "./components/layout/ScrollToTop"

// Public Pages
import { LandingPage } from "./pages/public/LandingPage"
import { LoginPage } from "./pages/public/LoginPage"
import { RegisterPage } from "./pages/public/RegisterPage"
import { ForgotPasswordPage } from "./pages/public/ForgotPasswordPage"
import { ResetPasswordPage } from "./pages/public/ResetPasswordPage"
import { VerifyEmailPage } from "./pages/public/VerifyEmailPage"
import { NotFoundPage } from "./pages/public/NotFoundPage"
import { PrivacyPage } from "./pages/public/PrivacyPage"
import { TermsPage } from "./pages/public/TermsPage"
import { ContactPage } from "./pages/public/ContactPage"
// Dashboard Pages
import { DashboardPage } from "./pages/dashboard/DashboardPage"
import { ProfilePage } from "./pages/dashboard/ProfilePage"
import { SettingsPage } from "./pages/dashboard/SettingsPage"
import { MyMeetingsPage } from "./pages/dashboard/MyMeetingsPage"

// Meeting Pages
import { CreateMeetingPage } from "./pages/meeting/CreateMeetingPage"
import { JoinMeetingPage } from "./pages/meeting/JoinMeetingPage"
import { LobbyPage } from "./pages/meeting/LobbyPage"
import { MeetingRoomPage } from "./pages/meeting/MeetingRoomPage"
import { MeetingEndedPage } from "./pages/meeting/MeetingEndedPage"

export function App() {
  // Confirms a restored token with the server, and keeps the session honest
  // across bfcache restores and other tabs. Must sit above <Routes> so the
  // guards below never render against an unverified session.
  useSessionBootstrap()

  return (
    <>
      <ScrollToTop />
      <Routes>
      {/* Guest-only auth routes: a signed-in user is bounced to /dashboard. */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Reached from a one-time emailed link, so it must stay available even
          if this browser still holds a stale session for that account. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Route>

      {/* Authenticated User Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          
          <Route path="/meeting/create" element={<CreateMeetingPage />} />
          <Route path="/join" element={<JoinMeetingPage />} />

          {/* /meeting/summary/:meetingId is intentionally NOT routed.
              MeetingSummaryPage.tsx still contains hard-coded placeholder content
              from the design phase (an invented transcript and action items). Until
              the AI summary feature is actually built, routing it would show
              fabricated data as if it were a real record of the user's meeting.
              Re-add the route when the page is wired to real data. */}

          <Route path="/dashboard/meetings" element={<MyMeetingsPage />} />
          {/* Areas that do not exist yet. `replace` keeps them out of history,
              otherwise the Back button bounces between here and /dashboard. */}
          <Route path="/dashboard/schedule" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard/analytics" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      {/* Dedicated Meeting Routes */}
      {/* Canonical: /meet/:meetingId (lobby, validates first) → /meet/:meetingId/room */}
      <Route element={<ProtectedRoute />}>
        <Route path="/meet/:meetingId" element={<LobbyPage />} />
        <Route path="/meet/:meetingId/room" element={<MeetingRoomPage />} />
        {/* Legacy paths kept so old links still resolve */}
        <Route path="/meeting/lobby/:meetingId" element={<LobbyPage />} />
        <Route path="/meeting/room/:meetingId" element={<MeetingRoomPage />} />
      </Route>
      <Route path="/meeting/ended" element={<MeetingEndedPage />} />

      {/* Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  )
}
