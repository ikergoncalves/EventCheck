import { CalendarDays, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router'
import type { Event } from '../../../shared/api/types'
import { formatEventDateTime } from '../../../shared/lib/datetime'
import { formatRatio } from '../../../shared/lib/format'
import { StatusBadge } from '../../../shared/ui/StatusBadge'

export function EventCard({ event }: { event: Event }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm">
      <Link to={`/events/${event.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900">{event.title}</h2>
          <StatusBadge status={event.status} />
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <CalendarDays aria-hidden className="size-4 text-slate-400" />
            <dt className="sr-only">Starts at</dt>
            <dd>{formatEventDateTime(event.starts_at, event.timezone)}</dd>
          </div>

          {event.venue_name && (
            <div className="flex items-center gap-1.5">
              <MapPin aria-hidden className="size-4 text-slate-400" />
              <dt className="sr-only">Venue</dt>
              <dd>{event.venue_name}</dd>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Users aria-hidden className="size-4 text-slate-400" />
            <dt className="sr-only">Checked in over tickets issued</dt>
            <dd>
              <span className="font-medium text-slate-900">
                {formatRatio(event.checked_in_count, event.tickets_issued)}
              </span>{' '}
              checked in
            </dd>
          </div>
        </dl>
      </Link>
    </li>
  )
}
