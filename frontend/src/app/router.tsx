import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute, RequireVerified } from "@/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { ChatsPage } from "@/features/chats/ChatsPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { MeetingDetailPage } from "@/features/meetings/MeetingDetailPage";
import { MeetingRoomPage } from "@/features/meetings/MeetingRoomPage";
import { MeetingsListPage } from "@/features/meetings/MeetingsListPage";
import { ScheduleMeetingPage } from "@/features/meetings/ScheduleMeetingPage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";
import { TasksPage } from "@/features/tasks/TasksPage";
import { WorkspacesPage } from "@/features/workspaces/WorkspacesPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

import { DashboardLayout } from "./DashboardLayout";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/meetings/:id/room"
        element={
          <ProtectedRoute>
            <RequireVerified>
              <MeetingRoomPage />
            </RequireVerified>
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/meetings" element={<MeetingsListPage />} />
        <Route
          path="/meetings/schedule"
          element={
            <RequireVerified>
              <ScheduleMeetingPage />
            </RequireVerified>
          }
        />
        <Route path="/meetings/:id" element={<MeetingDetailPage />} />
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/chats/:id" element={<ChatsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
