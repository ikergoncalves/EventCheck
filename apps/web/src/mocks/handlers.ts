/**
 * MSW handlers for every operation in the contract.
 *
 * These reproduce the error branches as faithfully as the happy paths — the
 * check-in flow in particular, whose codes drive distinct visual states in the
 * scanner UI.
 */
import { HttpResponse, http } from 'msw'
import { API_BASE_URL, API_V1 } from '../shared/api/config'
import {
  checkInClosesAt,
  checkInOpensAt,
  isWithinCheckInWindow,
} from '../shared/lib/check-in-window'
import type {
  ApiErrorCode,
  CheckInCreate,
  EventCreate,
  EventStatus,
  EventUpdate,
  Page,
  TicketBatchCreate,
  TicketStatus,
} from '../shared/api/types'
import {
  type ListEventsOptions,
  buildEventStats,
  buildReportData,
  cancelEvent,
  createEvent,
  findCheckInByTicket,
  findEvent,
  findTicket,
  findTicketByToken,
  getOrganizer,
  issueTickets,
  listCheckIns,
  listEvents,
  listTickets,
  publishEvent,
  registerCheckIn,
  reissueTicket,
  revokeTicket,
  toEvent,
  toTicket,
  updateEvent,
} from './db'

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return HttpResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  )
}

const eventNotFound = () => errorResponse(404, 'EVENT_NOT_FOUND', 'Event not found.')
const ticketNotFound = () => errorResponse(404, 'TICKET_NOT_FOUND', 'Ticket not found.')

/** Slices an array the way the contract's `Page` envelope describes. */
function paginate<T>(items: T[], url: URL, defaultPageSize: number): Page & { items: T[] } {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const pageSize = Math.max(1, Number(url.searchParams.get('page_size') ?? defaultPageSize))
  const start = (page - 1) * pageSize

  return {
    page,
    page_size: pageSize,
    total: items.length,
    total_pages: Math.max(1, Math.ceil(items.length / pageSize)),
    items: items.slice(start, start + pageSize),
  }
}

/** Stands in for the server's process uptime on `/health`. */
const BOOTED_AT = Date.now()

/* -------------------------------------------------------------------------- */
/* System                                                                      */
/* -------------------------------------------------------------------------- */

export const handlers = [
  http.get(`${API_BASE_URL}/health`, () =>
    HttpResponse.json({
      status: 'ok' as const,
      version: '1.0.0-mock',
      uptime_seconds: Math.floor((Date.now() - BOOTED_AT) / 1000),
      database: 'up' as const,
    }),
  ),

  http.get(`${API_V1}/me`, () => HttpResponse.json(getOrganizer())),

  /* ------------------------------------------------------------------------ */
  /* Events                                                                    */
  /* ------------------------------------------------------------------------ */

  http.get(`${API_V1}/events`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.getAll('status') as EventStatus[]
    const sort = url.searchParams.get('sort') as ListEventsOptions['sort']

    const events = listEvents({
      status: status.length > 0 ? status : undefined,
      search: url.searchParams.get('search') ?? undefined,
      sort: sort ?? undefined,
    })

    return HttpResponse.json(paginate(events, url, 20))
  }),

  http.post(`${API_V1}/events`, async ({ request }) => {
    const body = (await request.json()) as EventCreate

    if (!body.title || body.title.length < 3) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Request body is invalid.', {
        fields: [{ field: 'title', message: 'must be at least 3 characters long' }],
      })
    }
    if (Date.parse(body.ends_at) <= Date.parse(body.starts_at)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Request body is invalid.', {
        fields: [{ field: 'ends_at', message: 'must be after starts_at' }],
      })
    }

    const event = createEvent(body)
    return HttpResponse.json(event, {
      status: 201,
      headers: { Location: `/api/v1/events/${event.id}` },
    })
  }),

  http.get(`${API_V1}/events/:event_id`, ({ params }) => {
    const record = findEvent(String(params.event_id))
    if (!record) return eventNotFound()
    return HttpResponse.json(toEvent(record))
  }),

  http.patch(`${API_V1}/events/:event_id`, async ({ params, request }) => {
    const record = findEvent(String(params.event_id))
    if (!record) return eventNotFound()

    if (record.status === 'finished' || record.status === 'cancelled') {
      return errorResponse(409, 'EVENT_IMMUTABLE', `A ${record.status} event cannot be modified.`)
    }

    const body = (await request.json()) as EventUpdate
    if (Object.keys(body).length === 0) {
      return errorResponse(422, 'VALIDATION_ERROR', 'At least one field must be sent.')
    }

    return HttpResponse.json(updateEvent(record, body))
  }),

  http.delete(`${API_V1}/events/:event_id`, ({ params }) => {
    const record = findEvent(String(params.event_id))
    if (!record) return eventNotFound()

    if (record.status === 'cancelled') {
      return errorResponse(409, 'EVENT_IMMUTABLE', 'Event is already cancelled.')
    }

    cancelEvent(record)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API_V1}/events/:event_id/publish`, ({ params }) => {
    const record = findEvent(String(params.event_id))
    if (!record) return eventNotFound()

    if (record.status !== 'draft') {
      return errorResponse(409, 'EVENT_IMMUTABLE', 'Only draft events can be published.')
    }
    if (Date.parse(record.starts_at) <= Date.now()) {
      return errorResponse(409, 'EVENT_NOT_ACTIVE', 'starts_at must be in the future.')
    }

    return HttpResponse.json(publishEvent(record))
  }),

  /* ------------------------------------------------------------------------ */
  /* Tickets                                                                   */
  /* ------------------------------------------------------------------------ */

  http.get(`${API_V1}/events/:event_id/tickets`, ({ params, request }) => {
    const record = findEvent(String(params.event_id))
    if (!record) return eventNotFound()

    const url = new URL(request.url)
    const tickets = listTickets(record.id, {
      status: url.searchParams.getAll('status') as TicketStatus[],
      search: url.searchParams.get('search') ?? undefined,
    })

    return HttpResponse.json(paginate(tickets, url, 50))
  }),

  http.post(`${API_V1}/events/:event_id/tickets`, async ({ params, request }) => {
    const record = findEvent(String(params.event_id))
    if (!record) return eventNotFound()

    const body = (await request.json()) as TicketBatchCreate
    if (!Array.isArray(body.attendees) || body.attendees.length === 0) {
      return errorResponse(422, 'VALIDATION_ERROR', 'At least one attendee is required.')
    }

    const current = toEvent(record).tickets_issued
    if (current + body.attendees.length > record.capacity) {
      return errorResponse(
        409,
        'EVENT_CAPACITY_EXCEEDED',
        'Issuing these tickets would exceed the event capacity.',
        { capacity: record.capacity, tickets_issued: current, requested: body.attendees.length },
      )
    }

    const created = issueTickets(record.id, body.attendees)
    return HttpResponse.json(
      {
        items: created.map((ticket) => ({
          ...toTicket(ticket),
          qr_token: ticket.qr_token,
          qr_payload: `EVCK1:${ticket.qr_token}`,
        })),
      },
      { status: 201 },
    )
  }),

  http.get(`${API_V1}/tickets/:ticket_id`, ({ params }) => {
    const ticket = findTicket(String(params.ticket_id))
    if (!ticket) return ticketNotFound()
    return HttpResponse.json(toTicket(ticket))
  }),

  http.post(`${API_V1}/tickets/:ticket_id/revoke`, ({ params }) => {
    const ticket = findTicket(String(params.ticket_id))
    if (!ticket) return ticketNotFound()

    // Attendance history is never rewritten.
    if (ticket.status === 'checked_in') {
      return errorResponse(
        409,
        'TICKET_ALREADY_CHECKED_IN',
        'A ticket that was already used cannot be revoked.',
      )
    }
    if (ticket.status === 'revoked') {
      return errorResponse(409, 'TICKET_REVOKED', 'Ticket is already revoked.')
    }

    return HttpResponse.json(revokeTicket(ticket))
  }),

  http.post(`${API_V1}/tickets/:ticket_id/reissue`, ({ params }) => {
    const ticket = findTicket(String(params.ticket_id))
    if (!ticket) return ticketNotFound()

    if (ticket.status === 'checked_in') {
      return errorResponse(
        409,
        'TICKET_ALREADY_CHECKED_IN',
        'A ticket that was already used cannot be reissued.',
      )
    }
    if (ticket.status === 'revoked') {
      return errorResponse(409, 'TICKET_REVOKED', 'A revoked ticket cannot be reissued.')
    }

    const updated = reissueTicket(ticket)
    return HttpResponse.json({
      ...toTicket(updated),
      qr_token: updated.qr_token,
      qr_payload: `EVCK1:${updated.qr_token}`,
    })
  }),

  /* ------------------------------------------------------------------------ */
  /* Check-ins                                                                 */
  /* ------------------------------------------------------------------------ */

  http.post(`${API_V1}/events/:event_id/check-ins`, async ({ params, request }) => {
    const eventId = String(params.event_id)
    const record = findEvent(eventId)
    if (!record) return eventNotFound()

    const body = (await request.json()) as CheckInCreate
    const token = body.qr_token

    if (!token || token.length < 32 || token.length > 64) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Request body is invalid.', {
        fields: [{ field: 'qr_token', message: 'must be between 32 and 64 characters' }],
      })
    }

    const ticket = findTicketByToken(token)
    if (!ticket) return ticketNotFound()

    /*
     * The order of the branches below is the contract's precedence, and the
     * backend follows the same one: the same QR in the same situation has to
     * produce the same code on both sides.
     *
     *   TICKET_NOT_FOUND -> TICKET_WRONG_EVENT -> EVENT_NOT_ACTIVE
     *   -> TICKET_REVOKED -> TICKET_ALREADY_CHECKED_IN
     */
    if (ticket.event_id !== eventId) {
      return errorResponse(409, 'TICKET_WRONG_EVENT', 'This ticket belongs to another event.', {
        ticket_event_id: ticket.event_id,
        scanned_event_id: eventId,
      })
    }

    if (!isWithinCheckInWindow(record, Date.now())) {
      return errorResponse(
        409,
        'EVENT_NOT_ACTIVE',
        'This event is not accepting check-ins right now.',
        {
          status: record.status,
          check_in_opens_at: new Date(checkInOpensAt(record)).toISOString(),
          check_in_closes_at: new Date(checkInClosesAt(record)).toISOString(),
        },
      )
    }

    if (ticket.status === 'revoked') {
      return errorResponse(409, 'TICKET_REVOKED', 'This ticket was revoked.', {
        ticket_id: ticket.id,
        attendee_name: ticket.attendee_name,
      })
    }

    if (ticket.status === 'checked_in') {
      const original = findCheckInByTicket(ticket.id)
      return errorResponse(409, 'TICKET_ALREADY_CHECKED_IN', 'This ticket was already used.', {
        ticket_id: ticket.id,
        attendee_name: ticket.attendee_name,
        checked_in_at: original?.checked_in_at ?? ticket.checked_in_at,
        device_label: original?.device_label ?? null,
      })
    }

    const checkIn = registerCheckIn(ticket, body.device_label)
    const stats = buildEventStats(eventId, 15)

    return HttpResponse.json(
      {
        check_in: checkIn,
        ticket: toTicket(ticket),
        event_stats: {
          tickets_issued: stats.tickets_issued,
          checked_in_count: stats.checked_in_count,
        },
      },
      { status: 201 },
    )
  }),

  http.get(`${API_V1}/events/:event_id/check-ins`, ({ params, request }) => {
    const record = findEvent(String(params.event_id))
    if (!record) return eventNotFound()

    const url = new URL(request.url)
    const checkIns = listCheckIns(record.id, url.searchParams.get('since') ?? undefined)

    return HttpResponse.json(paginate(checkIns, url, 50))
  }),

  /* ------------------------------------------------------------------------ */
  /* Analytics                                                                 */
  /* ------------------------------------------------------------------------ */

  http.get(`${API_V1}/events/:event_id/stats`, ({ params, request }) => {
    const record = findEvent(String(params.event_id))
    if (!record) return eventNotFound()

    const url = new URL(request.url)
    const bucketMinutes = Number(url.searchParams.get('bucket_minutes') ?? 15)

    return HttpResponse.json(buildEventStats(record.id, bucketMinutes))
  }),

  http.get(`${API_V1}/events/:event_id/report-data`, ({ params }) => {
    const record = findEvent(String(params.event_id))
    if (!record) return eventNotFound()
    return HttpResponse.json(buildReportData(record))
  }),

  /* ------------------------------------------------------------------------ */
  /* Public                                                                    */
  /* ------------------------------------------------------------------------ */

  http.get(`${API_V1}/public/tickets/:qr_token`, ({ params }) => {
    const ticket = findTicketByToken(String(params.qr_token))
    if (!ticket) return ticketNotFound()

    const record = findEvent(ticket.event_id)
    if (!record) return eventNotFound()

    return HttpResponse.json({
      attendee_name: ticket.attendee_name,
      tier: ticket.tier ?? null,
      status: ticket.status,
      checked_in_at: ticket.checked_in_at ?? null,
      event: {
        title: record.title,
        starts_at: record.starts_at,
        ends_at: record.ends_at,
        timezone: record.timezone,
        venue_name: record.venue_name ?? null,
        address: record.address ?? null,
      },
    })
  }),
]
