import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Briefcase, MessageSquare, FileText, ClipboardList, Landmark, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from '../theme/ThemeToggle'

const NAV = [
  { to: '/services',    icon: Briefcase,     label: 'Мої послуги' },
  { to: '/notes',       icon: MessageSquare, label: 'Коментарі' },
  { to: '/requests',    icon: FileText,      label: 'Заявки' },
  { to: '/law-changes', icon: ClipboardList, label: 'Зміни законів' },
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
    <div className="flex h-screen bg-canvas overflow-hidden">
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
        w-56 flex-shrink-0 flex flex-col bg-paper border-r border-line
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-lg bg-[#0E4D6E] text-white flex items-center justify-center flex-shrink-0">
              <Landmark size={17} strokeWidth={1.7} />
            </div>
            <div>
              <div className="text-sm font-bold text-ink leading-tight">Legal AI</div>
              <div className="text-xs text-inkMute">Admin Panel</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-inkSoft hover:text-ink p-1"
          >✕</button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-brand/10 text-brand'
                   : 'text-inkSoft hover:text-ink hover:bg-paperAlt'}`
              }
            >
              <Icon size={18} strokeWidth={1.7} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-line">
          <div className="px-3 py-2 mb-1 flex items-center justify-between gap-2">
            <div className="text-xs text-inkMute truncate">{user?.email}</div>
            <ThemeToggle className="flex-shrink-0" />
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-inkSoft hover:text-ink hover:bg-paperAlt transition-colors"
          >
            <LogOut size={17} strokeWidth={1.7} className="flex-shrink-0" />
            <span>Вийти</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-canvas min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-line bg-paper">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-inkSoft hover:text-ink p-1"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect y="3" width="20" height="2" rx="1"/>
              <rect y="9" width="20" height="2" rx="1"/>
              <rect y="15" width="20" height="2" rx="1"/>
            </svg>
          </button>
          <span className="text-ink text-sm font-semibold">Legal AI</span>
          <span className="flex-1" />
          <ThemeToggle />
        </div>
        {children}
      </main>
    </div>
  )
}
