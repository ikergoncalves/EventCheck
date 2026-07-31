import { Navigate, Route, Routes } from 'react-router'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { SignupPage } from '../features/auth/pages/SignupPage'
import { EventDetailPage } from '../features/events/pages/EventDetailPage'
import { EventEditPage } from '../features/events/pages/EventEditPage'
import { EventNewPage } from '../features/events/pages/EventNewPage'
import { EventsListPage } from '../features/events/pages/EventsListPage'
import { AppLayout } from './layout/AppLayout'
import { NotFoundPage } from './NotFoundPage'
import { RedirectIfAuthenticated, RequireAuth } from './route-guards'

export function AppRoutes() {
  return (
    <Routes>
      {/* Signed out only: a live session sends these straight back to the app. */}
      <Route element={<RedirectIfAuthenticated />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
      </Route>

      {/* Everything else needs a session, the 404 included. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/events" replace />} />
          <Route path="events" element={<EventsListPage />} />
          <Route path="events/new" element={<EventNewPage />} />
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="events/:eventId/edit" element={<EventEditPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
