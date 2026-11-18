import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards'
import { LoadingState } from './components/ui'

const LoginPage = lazy(() => import('./pages/auth/AuthPages').then((module) => ({ default: module.LoginPage })))
const RegisterPage = lazy(() => import('./pages/auth/AuthPages').then((module) => ({ default: module.RegisterPage })))
const ForgotPasswordPage = lazy(() =>
  import('./pages/auth/AuthPages').then((module) => ({ default: module.ForgotPasswordPage })),
)
const ResetPasswordPage = lazy(() =>
  import('./pages/auth/AuthPages').then((module) => ({ default: module.ResetPasswordPage })),
)
const TodayPage = lazy(() => import('./pages/TodayPage'))
const AgendaPage = lazy(() => import('./pages/agenda/AgendaPage'))
const TasksPage = lazy(() => import('./pages/agenda/TasksPage'))
const NotesPage = lazy(() => import('./pages/agenda/NotesPage'))
const FoodPage = lazy(() => import('./pages/food/FoodPage'))
const TrainingPage = lazy(() => import('./pages/training/TrainingPage'))
const FinancePage = lazy(() => import('./pages/finance/FinancePage'))
const ProgressPage = lazy(() => import('./pages/progress/ProgressPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function PageFallback() {
  return <LoadingState label="Cargando" />
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPasswordPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/today" element={<TodayPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/agenda/tasks" element={<TasksPage />} />
          <Route path="/agenda/notes" element={<NotesPage />} />
          <Route path="/food" element={<Navigate to="/food/planner" replace />} />
          <Route path="/food/:section" element={<FoodPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
