import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { to: '/services',    icon: '⚖️', label: 'Мої послуги' },
  { to: '/law-changes', icon: '📋', label: 'Зміни законів' },
]

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        w-56 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏛</span>
            <div>
              <div className="text-sm font-bold text-white">Legal AI</div>
              <div className="text-xs text-slate-500">Admin Panel</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1"
          >✕</button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-blue-600 text-white'
                   : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
              }
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3 py-2 mb-1">
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span>🚪</span>
            <span>Вийти</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-950 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white p-1"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect y="3" width="20" height="2" rx="1"/>
              <rect y="9" width="20" height="2" rx="1"/>
              <rect y="15" width="20" height="2" rx="1"/>
            </svg>
          </button>
          <span className="text-white text-sm font-semibold">Legal AI</span>
        </div>
        {children}
      </main>
    </div>
  )
}
