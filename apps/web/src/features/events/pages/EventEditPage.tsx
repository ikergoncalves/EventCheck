import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { describeError } from '../../../shared/api/describe-error'
import type { Event, EventCreate } from '../../../shared/api/types'
import { utcIsoToZonedInput } from '../../../shared/lib/datetime'
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/states'
import { useEvent, useUpdateEvent } from '../api'
import { EventForm } from '../components/EventForm'
import { isEditable } from '../event-actions'
import type { EventFormValues } from '../event-schema'

export function EventEditPage() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()

  const { data: event, isPending, isError, error, refetch } = useEvent(eventId)
  const updateEvent = useUpdateEvent(eventId)

  const backTo = `/events/${eventId}`

  const handleSubmit = async (payload: EventCreate): Promise<void> => {
    // `EventUpdate` makes every field optional, so a complete body is a valid
    // partial update — which is what lets one form serve POST and PATCH.
    await updateEvent.mutateAsync(payload)
    void navigate(backTo, { replace: true })
  }

  return (
    <section>
      <Link
        to={backTo}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to the event
      </Link>

      {isPending && <LoadingState label="Loading event…" />}

      {isError && (
        <ErrorState
          title="Could not load this event"
          description={describeError(error)}
          onRetry={() => void refetch()}
        />
      )}

      {!isPending && !isError && !isEditable(event.status) && (
        // The status may well have moved since the detail page rendered its
        // buttons — the lazy transition to `finished` needs nobody's click.
        <EmptyState
          title="This event can no longer be edited"
          description={`A ${event.status} event is immutable. Its details are kept as a record of what happened.`}
        />
      )}

      {!isPending && !isError && isEditable(event.status) && (
        <>
          <header className="mb-6">
            <h1 className="text-xl font-semibold text-slate-900">Edit event</h1>
            <p className="mt-1 text-sm text-slate-500">{event.title}</p>
          </header>

          <EventForm
            defaultValues={toFormValues(event)}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            cancelTo={backTo}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </section>
  )
}

/** Renders the stored instants back as wall-clock values in the event's zone. */
function toFormValues(event: Event): EventFormValues {
  return {
    title: event.title,
    description: event.description ?? '',
    startsAtLocal: utcIsoToZonedInput(event.starts_at, event.timezone),
    endsAtLocal: utcIsoToZonedInput(event.ends_at, event.timezone),
    timezone: event.timezone,
    venueName: event.venue_name ?? '',
    address: event.address ?? '',
    capacity: event.capacity,
  }
}
