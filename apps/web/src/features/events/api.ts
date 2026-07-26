/** Query layer for the events feature. */
import { useQuery } from '@tanstack/react-query'
import { api } from '../../shared/api/http'
import type { Event, EventListQuery, EventListResponse } from '../../shared/api/types'

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
