/**
 * Route guards.
 *
 * The whole design turns on `status === 'loading'` being a state of its own.
 * Restoring a persisted session is asynchronous, so on every single page load
 * the app spends a tick not knowing who the user is. A guard that treats that
 * tick as "anonymous" redirects to `/login`, the session then arrives, and the
 * organizer is bounced back — the login screen flashing on every refresh of a
 * page they are perfectly entitled to see. So `loading` renders, and only a
 * settled `anonymous` redirects.
 */
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../shared/auth/useAuth'
import { LoadingState } from '../shared/ui/states'
import { readIntendedRoute } from './intended-route'

function FullPageLoading({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50">
      <LoadingState label={label} />
    </div>
  )
}

/** Wraps the routes only a signed-in organizer may see. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoading label="Restoring your session…" />

  if (status === 'anonymous') {
    // Remember where they were headed so signing in finishes the journey
    // instead of dumping them on the events list.
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    )
  }

  return <Outlet />
}

/**
 * Wraps `/login` and `/signup`.
 *
 * Same reasoning mirrored: while the session is still being restored these
 * screens must not render either, or a refresh on `/login` with a valid session
 * would show a login form for a moment before bouncing to the app.
 */
export function RedirectIfAuthenticated() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoading label="Checking your session…" />

  if (status === 'authenticated') {
    return <Navigate to={readIntendedRoute(location.state)} replace />
  }

  return <Outlet />
}
