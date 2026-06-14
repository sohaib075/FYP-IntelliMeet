import { Routes, Route, Navigate } from "react-router-dom"

// Layouts
import { PublicLayout } from "./layouts/PublicLayout"
import { DashboardLayout } from "./layouts/DashboardLayout"

import { ProtectedRoute } from "./components/auth/ProtectedRoute"
import { ScrollToTop } from "./components/layout/ScrollToTop"

// Public Pages
import { LandingPage } from "./pages/public/LandingPage"
import { LoginPage } from "./pages/public/LoginPage"
import { RegisterPage } from "./pages/public/RegisterPage"
import { ForgotPasswordPage } from "./pages/public/ForgotPasswordPage"
import { ResetPasswordPage } from "./pages/public/ResetPasswordPage"
import { VerifyEmailPage } from "./pages/public/VerifyEmailPage"
import { StatusPreviewPage } from "./pages/public/StatusPreviewPage"
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
import { MeetingSummaryPage } from "./pages/meeting/MeetingSummaryPage"
import { MeetingEndedPage } from "./pages/meeting/MeetingEndedPage"

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      {/* Auth Routes (Standalone) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/status-preview" element={<StatusPreviewPage />} />
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
          <Route path="/meeting/summary/:meetingId" element={<MeetingSummaryPage />} />
          
          {/* Placeholders for links from dashboard */}
          <Route path="/dashboard/meetings" element={<MyMeetingsPage />} />
          <Route path="/dashboard/schedule" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard/analytics" element={<Navigate to="/dashboard" />} />
        </Route>
      </Route>

      {/* Dedicated Meeting Routes */}
      <Route element={<ProtectedRoute />}>
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
