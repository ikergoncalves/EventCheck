/** Query and mutation layer for the events feature. */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api/http'
import type {
  Event,
  EventCreate,
  EventListQuery,
  EventListResponse,
  EventUpdate,
} from '../../shared/api/types'

export const eventKeys = {
  all: ['events'] as const,
  list: (query: EventListQuery = {}) => [...eventKeys.all, 'list', query] as const,
  detail: (eventId: string) => [...eventKeys.all, 'detail', eventId] as const,
}

export function useEvents(query: EventListQuery = {}) {
  return useQuery({
    queryKey: eventKeys.list(query),
    queryFn: ({ signal }) => api.get<EventListResponse>('/api/v1/events', { query, signal }),
  })
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: ({ signal }) => api.get<Event>(`/api/v1/events/${eventId}`, { signal }),
    enabled: eventId.length > 0,
  })
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Seeds the server's own response into the detail cache.
 *
 * The screen then updates on the spot, and the refetch below only confirms it.
 */
function seedEvent(queryClient: QueryClient, event: Event): void {
  queryClient.setQueryData(eventKeys.detail(event.id), event)
}

/**
 * Refreshes everything an event mutation can have changed.
 *
 * Both the lists and the detail hang off `eventKeys.all`, and invalidating the
 * whole subtree is the honest choice rather than an over-broad one: a write
 * moves counters and status, the list is filtered and sorted on exactly those,
 * and the contract's lazy `published` -> `finished` transition means a request
 * can come back carrying a status nobody asked to change.
 *
 * It runs on failure too, and that is the point of `onSettled`. A `409` is the
 * server saying the state moved out from under this page; re-reading it is
 * precisely the right response, and it is what makes the buttons correct
 * themselves instead of offering the same impossible action again.
 */
function invalidateEvents(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: eventKeys.all })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: EventCreate) => api.post<Event>('/api/v1/events', body),
    onSuccess: (event) => {
      seedEvent(queryClient, event)
    },
    onSettled: () => {
      invalidateEvents(queryClient)
    },
  })
}

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: EventUpdate) => api.patch<Event>(`/api/v1/events/${eventId}`, body),
    onSuccess: (event) => {
      seedEvent(queryClient, event)
    },
    onSettled: () => {
      invalidateEvents(queryClient)
    },
  })
}

export function usePublishEvent(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.post<Event>(`/api/v1/events/${eventId}/publish`),
    onSuccess: (event) => {
      seedEvent(queryClient, event)
    },
    onSettled: () => {
      invalidateEvents(queryClient)
    },
  })
}

/** Soft delete: the event becomes `cancelled` and its valid tickets revoked. */
export function useCancelEvent(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    // The contract answers 204, so there is no event to seed the cache with.
    mutationFn: () => api.delete<void>(`/api/v1/events/${eventId}`),
    onSettled: () => {
      invalidateEvents(queryClient)
    },
  })
}
