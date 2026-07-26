import { CalendarDays, LayoutDashboard, QrCode, ScanLine, Ticket } from 'lucide-react'
import type { ComponentType } from 'react'
import { NavLink, Outlet } from 'react-router'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  /** Phases 2–4 land these; shown disabled so the shape of the app is visible. */
  enabled: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/events', label: 'Events', icon: CalendarDays, enabled: true },
  { to: '/tickets', label: 'Tickets', icon: Ticket, enabled: false },
  { to: '/check-in', label: 'Check-in', icon: ScanLine, enabled: false },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: false },
]

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <QrCode aria-hidden className="size-5 text-emerald-600" />
          <span className="font-semibold">EventCheck</span>
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            Phase 1
          </span>
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
