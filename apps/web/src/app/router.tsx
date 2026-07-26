import { Navigate, Route, Routes } from 'react-router'
import { EventDetailPage } from '../features/events/pages/EventDetailPage'
import { EventsListPage } from '../features/events/pages/EventsListPage'
import { AppLayout } from './layout/AppLayout'
import { NotFoundPage } from './NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/events" replace />} />
        <Route path="events" element={<EventsListPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
