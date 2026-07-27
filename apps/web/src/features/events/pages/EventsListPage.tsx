import { useEvents } from '../api'
import { EventCard } from '../components/EventCard'
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/states'
import { describeError } from '../../../shared/api/describe-error'

export function EventsListPage() {
  const { data, isPending, isError, error, refetch } = useEvents()

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Events</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every event you organize, with live attendance.
        </p>
      </header>

      {isPending && <LoadingState label="Loading events…" />}

      {isError && (
        <ErrorState
          title="Could not load your events"
          description={describeError(error)}
          onRetry={() => void refetch()}
        />
      )}

      {!isPending && !isError && data.items.length === 0 && (
        <EmptyState
          title="No events yet"
          description="Events you create will show up here, together with their check-in numbers."
        />
      )}

      {!isPending && !isError && data.items.length > 0 && (
        <ul className="grid gap-3">
          {data.items.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </ul>
      )}
    </section>
  )
}
