import { CalendarDays, LayoutDashboard, LogOut, QrCode, ScanLine, Ticket } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../shared/auth/useAuth'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  /** Phases 3–4 land these; shown disabled so the shape of the app is visible. */
  enabled: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/events', label: 'Events', icon: CalendarDays, enabled: true },
  { to: '/tickets', label: 'Tickets', icon: Ticket, enabled: false },
  { to: '/check-in', label: 'Check-in', icon: ScanLine, enabled: false },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: false },
]

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async (): Promise<void> => {
    setIsSigningOut(true)
    try {
      await signOut()
      // Signing out is a deliberate exit, so the next sign-in starts fresh
      // rather than resuming the page they happened to be on.
      void navigate('/login', { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <QrCode aria-hidden className="size-5 text-emerald-600" />
          <span className="font-semibold">EventCheck</span>
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            Phase 2
          </span>

          <div className="ml-auto flex items-center gap-3">
            {user?.email && (
              <span className="hidden text-sm text-slate-600 sm:inline" title={user.email}>
                {user.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut aria-hidden className="size-4" />
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-48 shrink-0 sm:block">
          <nav aria-label="Main">
            <ul className="space-y-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon, enabled }) => (
                <li key={to}>
                  {enabled ? (
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                          isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                        }`
                      }
                    >
                      <Icon aria-hidden className="size-4" />
                      {label}
                    </NavLink>
                  ) : (
                    <span
                      aria-disabled
                      title="Coming in a later phase"
                      className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-400"
                    >
                      <Icon aria-hidden className="size-4" />
                      {label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
