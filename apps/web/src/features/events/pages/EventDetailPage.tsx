import { ArrowLeft, CalendarDays, MapPin, Pencil, Send, Ticket, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { describeError } from '../../../shared/api/describe-error'
import type { Event } from '../../../shared/api/types'
import { formatEventDateRange } from '../../../shared/lib/datetime'
import { formatPercentage, formatRatio } from '../../../shared/lib/format'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { Button, FormAlert } from '../../../shared/ui/form'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/states'
import { useCancelEvent, useEvent, usePublishEvent } from '../api'
import { isCancellable, isEditable, isPublishable } from '../event-actions'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

/**
 * The lifecycle controls.
 *
 * Impossible actions are not rendered — but the ones that are rendered still
 * assume they might be refused. The status behind these buttons was read when
 * the page loaded, and the contract promotes a `published` event to `finished`
 * on the first read or write after its check-in window closes, without anyone
 * doing anything. So a `409` here is an ordinary outcome, not an exception:
 * it is reported in place, and the invalidation that follows every mutation
 * re-reads the event so the buttons settle on what is actually possible.
 */
function EventActions({ event }: { event: Event }) {
  const publishEvent = usePublishEvent(event.id)
  const cancelEvent = useCancelEvent(event.id)

  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)

  const conflict = publishEvent.error ?? cancelEvent.error

  return (
    <>
      {conflict && !isConfirmingCancel && (
        <div className="mb-4">
          <FormAlert>{describeError(conflict)}</FormAlert>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isEditable(event.status) && (
          <Link
            to={`/events/${event.id}/edit`}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Pencil aria-hidden className="size-4" />
            Edit
          </Link>
        )}

        {isPublishable(event.status) && (
          <Button
            type="button"
            onClick={() => publishEvent.mutate()}
            disabled={publishEvent.isPending}
          >
            <Send aria-hidden className="size-4" />
            {publishEvent.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        )}

        {isCancellable(event.status) && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              cancelEvent.reset()
              setIsConfirmingCancel(true)
            }}
          >
            <Trash2 aria-hidden className="size-4" />
            Cancel event
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={isConfirmingCancel}
        title={`Cancel “${event.title}”?`}
        description="The event moves to cancelled and every valid ticket for it is revoked — nobody will be able to check in. Check-ins already registered are kept as a record. This cannot be undone."
        confirmLabel="Cancel the event"
        pendingLabel="Cancelling…"
        cancelLabel="Keep the event"
        isPending={cancelEvent.isPending}
        error={cancelEvent.error ? describeError(cancelEvent.error) : null}
        onCancel={() => setIsConfirmingCancel(false)}
        onConfirm={() => {
          cancelEvent.mutate(undefined, {
            // Stay open on failure so the reason is read where the decision
            // was made; the refetch behind it corrects the buttons regardless.
            onSuccess: () => setIsConfirmingCancel(false),
          })
        }}
      />
    </>
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

          <div className="mb-6">
            <EventActions event={event} />
          </div>

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
