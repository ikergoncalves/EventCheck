import { ArrowLeft, CalendarDays, MapPin, Ticket } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useEvent } from '../api'
import { describeError } from '../../../shared/api/describe-error'
import { formatEventDateRange } from '../../../shared/lib/datetime'
import { formatPercentage, formatRatio } from '../../../shared/lib/format'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/states'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function EventDetailPage() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const { data: event, isPending, isError, error, refetch } = useEvent(eventId)

  return (
    <section>
      <Link
        to="/events"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to events
      </Link>

      {isPending && <LoadingState label="Loading event…" />}

      {isError && (
        <ErrorState
          title="Could not load this event"
          description={describeError(error)}
          onRetry={() => void refetch()}
        />
      )}

      {!isPending && !isError && !event && (
        <EmptyState title="Event not found" description="This event may have been removed." />
      )}

      {!isPending && !isError && event && (
        <>
          <header className="mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900">{event.title}</h1>
              <StatusBadge status={event.status} />
            </div>

            {event.description && (
              <p className="mt-2 text-sm text-slate-600">{event.description}</p>
            )}

            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-1.5">
                <CalendarDays aria-hidden className="size-4 text-slate-400" />
                <dt className="sr-only">When</dt>
                <dd>{formatEventDateRange(event.starts_at, event.ends_at, event.timezone)}</dd>
              </div>

              {event.venue_name && (
                <div className="flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4 text-slate-400" />
                  <dt className="sr-only">Venue</dt>
                  <dd>
                    {event.venue_name}
                    {event.address ? ` — ${event.address}` : ''}
                  </dd>
                </div>
              )}
            </dl>
          </header>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Checked in"
              value={formatRatio(event.checked_in_count, event.tickets_issued)}
              hint={`${formatPercentage(event.checked_in_count, event.tickets_issued)} attendance`}
            />
            <Stat label="Tickets issued" value={String(event.tickets_issued)} />
            <Stat
              label="Capacity"
              value={String(event.capacity)}
              hint={`${formatPercentage(event.tickets_issued, event.capacity)} filled`}
            />
          </div>

          <p className="mt-6 flex items-center gap-1.5 text-sm text-slate-500">
            <Ticket aria-hidden className="size-4 text-slate-400" />
            Ticket issuing, the live dashboard and the QR scanner arrive in the next phases.
          </p>
        </>
      )}
    </section>
  )
}
