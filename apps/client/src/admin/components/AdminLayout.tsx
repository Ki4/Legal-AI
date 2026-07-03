import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Briefcase, MessageSquare, FileText, ClipboardList, Landmark, LogOut,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from '../theme/ThemeToggle'

const NAV = [
  { to: '/services',    icon: Briefcase,     label: 'Мої послуги' },
  { to: '/notes',       icon: MessageSquare, label: 'Коментарі' },
  { to: '/requests',    icon: FileText,      label: 'Заявки' },
  { to: '/law-changes', icon: ClipboardList, label: 'Зміни законів' },
]

// Manual collapse for the whole admin (issue #87 decision 7) — icons + tooltip,
// state persisted the same way as the theme choice (theme/theme.ts pattern).
const RAIL_KEY = 'admin-sidebar-collapsed'

function readRailCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === '1'
  } catch {
    return false
  }
}

function storeRailCollapsed(v: boolean): void {
  try {
    localStorage.setItem(RAIL_KEY, v ? '1' : '0')
  } catch {
    /* localStorage unavailable (private mode) — this session only */
  }
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readRailCollapsed)

  useEffect(() => storeRailCollapsed(collapsed), [collapsed])

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

      {/* Sidebar — collapses to an icon rail on desktop only (mobile drawer stays full width) */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        w-56 ${collapsed ? 'md:w-14' : 'md:w-56'} flex-shrink-0 flex flex-col bg-paper border-r border-line
        transition-transform md:transition-[width] duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`px-5 py-5 border-b border-line flex items-center ${collapsed ? 'md:justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-lg bg-[#0E4D6E] text-white flex items-center justify-center flex-shrink-0">
              <Landmark size={17} strokeWidth={1.7} />
            </div>
            <div className={collapsed ? 'md:hidden' : ''}>
              <div className="text-sm font-bold text-ink leading-tight">Legal AI</div>
              <div className="text-xs text-inkMute">Admin Panel</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-inkSoft hover:text-ink p-1"
          >✕</button>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              title="Згорнути меню"
              aria-label="Згорнути меню"
              className="hidden md:flex text-inkMute hover:text-ink p-1 rounded-lg hover:bg-paperAlt transition-colors flex-shrink-0"
            >
              <PanelLeftClose size={17} strokeWidth={1.7} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="Розгорнути меню"
            aria-label="Розгорнути меню"
            className="hidden md:flex items-center justify-center w-full py-2 border-b border-line text-inkMute hover:text-ink hover:bg-paperAlt transition-colors"
          >
            <PanelLeftOpen size={17} strokeWidth={1.7} />
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${collapsed ? 'md:justify-center md:px-0' : ''}
                 ${isActive
                   ? 'bg-brand/10 text-brand'
                   : 'text-inkSoft hover:text-ink hover:bg-paperAlt'}`
              }
            >
              <Icon size={18} strokeWidth={1.7} className="flex-shrink-0" />
              <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-line">
          <div className={`px-3 py-2 mb-1 flex items-center gap-2 ${collapsed ? 'md:justify-center' : 'justify-between'}`}>
            <div className={`text-xs text-inkMute truncate ${collapsed ? 'md:hidden' : ''}`}>{user?.email}</div>
            <ThemeToggle className="flex-shrink-0" />
          </div>
          <button
            onClick={handleSignOut}
            title="Вийти"
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-inkSoft hover:text-ink hover:bg-paperAlt transition-colors ${collapsed ? 'md:justify-center md:px-0' : ''}`}
          >
            <LogOut size={17} strokeWidth={1.7} className="flex-shrink-0" />
            <span className={collapsed ? 'md:hidden' : ''}>Вийти</span>
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
