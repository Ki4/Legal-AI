import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './hooks/useAuth'
import { LoginPage }          from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage }  from './pages/ResetPasswordPage'
import { DashboardPage }      from './pages/DashboardPage'
import { ServiceEditPage }    from './pages/ServiceEditPage'
import { ServiceViewPage }    from './pages/ServiceViewPage'
import { NotesInboxPage }     from './pages/NotesInboxPage'
import { ServiceRequestsPage } from './pages/ServiceRequestsPage'
import { LawChangeLogPage }   from './pages/LawChangeLogPage'
import { VizLabPage }         from './pages/VizLabPage'

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function AdminApp() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password')
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <Routes>
      <Route path="login"          element={<LoginPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password"  element={<ResetPasswordPage />} />
      <Route path="services" element={<AdminGuard><DashboardPage /></AdminGuard>} />
      <Route path="services/new" element={<AdminGuard><ServiceEditPage /></AdminGuard>} />
      <Route path="services/:id/edit" element={<AdminGuard><ServiceEditPage /></AdminGuard>} />
      <Route path="services/:id" element={<AdminGuard><ServiceViewPage /></AdminGuard>} />
      <Route path="notes" element={<AdminGuard><NotesInboxPage /></AdminGuard>} />
      <Route path="requests" element={<AdminGuard><ServiceRequestsPage /></AdminGuard>} />
      <Route path="law-changes" element={<AdminGuard><LawChangeLogPage /></AdminGuard>} />
      {/* viz-lab: standalone visualization prototype gallery (demo data, no auth needed) */}
      <Route path="viz-lab" element={<VizLabPage />} />
      <Route path="*" element={<Navigate to="/services" replace />} />
    </Routes>
  )
}
