import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import type { EventCreate } from '../../../shared/api/types'
import { browserTimeZone } from '../../../shared/lib/datetime'
import { useCreateEvent } from '../api'
import { EventForm } from '../components/EventForm'
import type { EventFormValues } from '../event-schema'

/** A reasonable room, and the organizer's own zone. Everything else is theirs. */
const DEFAULT_CAPACITY = 100

export function EventNewPage() {
  const navigate = useNavigate()
  const createEvent = useCreateEvent()

  const defaultValues: EventFormValues = {
    title: '',
    description: '',
    startsAtLocal: '',
    endsAtLocal: '',
    timezone: browserTimeZone(),
    venueName: '',
    address: '',
    capacity: DEFAULT_CAPACITY,
  }

  const handleSubmit = async (payload: EventCreate): Promise<void> => {
    // Rejections propagate on purpose: the form turns a 422 into field errors.
    const event = await createEvent.mutateAsync(payload)
    void navigate(`/events/${event.id}`, { replace: true })
  }

  return (
    <section>
      <Link
        to="/events"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to events
      </Link>

      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">New event</h1>
        <p className="mt-1 text-sm text-slate-500">
          It starts as a draft. Publish it when you are ready to issue tickets.
        </p>
      </header>

      <EventForm
        defaultValues={defaultValues}
        submitLabel="Create event"
        pendingLabel="Creating…"
        cancelTo="/events"
        onSubmit={handleSubmit}
      />
    </section>
  )
}
