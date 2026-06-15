import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Building2, LayoutDashboard, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { HealthBadge } from '@/features/health/HealthBadge'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  testid: string
}

// Navigation grows per phase. Phase 0 ships the dashboard entry only.
const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, testid: 'nav-dashboard' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        data-testid="sidebar"
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Building2 className="size-5" />
          </div>
          <span className="text-lg font-bold text-slate-900">HRMS</span>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              data-testid={item.testid}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Backdrop on mobile */}
      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            data-testid="menu-toggle"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className="flex-1" />
          <HealthBadge />
          <div className="hidden text-sm text-slate-600 sm:block" data-testid="current-user-email">
            {user?.email}
          </div>
          <button
            onClick={handleSignOut}
            data-testid="sign-out"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8" data-testid="app-main">
          {children}
        </main>
      </div>
    </div>
  )
}
