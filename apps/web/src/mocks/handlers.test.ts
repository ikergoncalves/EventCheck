/**
 * Guards the two properties the mock layer exists to provide: the fixed dev
 * tokens really do trigger their contract error, and mutations keep the
 * counters consistent across calls.
 */
import { describe, expect, it } from 'vitest'
import { readFieldErrors } from '../shared/api/field-errors'
import { apiFetch } from '../shared/api/http'
import type {
  CheckInResult,
  Event,
  Ticket,
  TicketBatchResponse,
  TicketListResponse,
} from '../shared/api/types'
import { expectApiError } from '../test/api'
import { resetDb } from './db'
import { DEV_TOKENS, EVENT_IDS } from './fixtures'

const DAY = 24 * 60 * 60 * 1000

function checkIn(eventId: string, qrToken: string) {
  return apiFetch<CheckInResult>(`/api/v1/events/${eventId}/check-ins`, {
    method: 'POST',
    body: { qr_token: qrToken, device_label: 'Portaria A' },
  })
}

describe('check-in error paths', () => {
  it('404 TICKET_NOT_FOUND for a token nobody issued', async () => {
    const error = await expectApiError(checkIn(EVENT_IDS.published, DEV_TOKENS.unknown))

    expect(error.status).toBe(404)
    expect(error.code).toBe('TICKET_NOT_FOUND')
  })

  it('409 TICKET_ALREADY_CHECKED_IN, carrying the original check-in in details', async () => {
    const error = await expectApiError(checkIn(EVENT_IDS.published, DEV_TOKENS.alreadyCheckedIn))

    expect(error.status).toBe(409)
    expect(error.code).toBe('TICKET_ALREADY_CHECKED_IN')
    expect(error.details).toMatchObject({
      attendee_name: 'Dev Already Checked In',
      device_label: 'Portaria A',
    })
    expect(error.details?.checked_in_at).toEqual(expect.any(String))
  })

  it('409 TICKET_REVOKED for a revoked ticket', async () => {
    const error = await expectApiError(checkIn(EVENT_IDS.published, DEV_TOKENS.revoked))

    expect(error.status).toBe(409)
    expect(error.code).toBe('TICKET_REVOKED')
  })

  it('409 TICKET_WRONG_EVENT for a ticket issued for another event', async () => {
    const error = await expectApiError(checkIn(EVENT_IDS.published, DEV_TOKENS.wrongEvent))

    expect(error.status).toBe(409)
    expect(error.code).toBe('TICKET_WRONG_EVENT')
  })

  it('409 EVENT_NOT_ACTIVE when the event is not open for check-ins', async () => {
    const error = await expectApiError(checkIn(EVENT_IDS.finished, DEV_TOKENS.eventNotActive))

    expect(error.status).toBe(409)
    expect(error.code).toBe('EVENT_NOT_ACTIVE')
  })

  it('409 EVENT_NOT_ACTIVE while the window is still shut on a published event', async () => {
    const error = await expectApiError(checkIn(EVENT_IDS.upcoming, DEV_TOKENS.beforeWindow))

    expect(error.status).toBe(409)
    expect(error.code).toBe('EVENT_NOT_ACTIVE')
    // The status alone would have let this through: it is the window that closed it.
    expect(error.details).toMatchObject({ status: 'published' })
  })

  it('puts EVENT_NOT_ACTIVE ahead of TICKET_REVOKED, as the contract orders them', async () => {
    const tickets = await apiFetch<TicketListResponse>(
      `/api/v1/events/${EVENT_IDS.upcoming}/tickets`,
      { query: { search: 'Dev Before Window' } },
    )
    expect(tickets.items).toHaveLength(1)

    const revoked = await apiFetch<Ticket>(`/api/v1/tickets/${tickets.items[0].id}/revoke`, {
      method: 'POST',
    })
    expect(revoked.status).toBe('revoked')

    // Both branches now apply. Precedence says the event's window answers first.
    const error = await expectApiError(checkIn(EVENT_IDS.upcoming, DEV_TOKENS.beforeWindow))

    expect(error.status).toBe(409)
    expect(error.code).toBe('EVENT_NOT_ACTIVE')
  })
})

describe('lazy finished transition', () => {
  it('reads a published event whose window has closed as finished', async () => {
    // Seeded three days ago, so the live event's `ends_at + 2h` is long past.
    // Nothing runs on a schedule: the read itself has to notice.
    resetDb(Date.now() - 3 * DAY)

    const event = await apiFetch<Event>(`/api/v1/events/${EVENT_IDS.published}`)

    expect(event.status).toBe('finished')
  })

  it('persists the transition, so a later write sees a finished event', async () => {
    resetDb(Date.now() - 3 * DAY)

    const error = await expectApiError(
      apiFetch(`/api/v1/events/${EVENT_IDS.published}`, {
        method: 'PATCH',
        body: { title: 'Renamed after the fact' },
      }),
    )

    expect(error.status).toBe(409)
    expect(error.code).toBe('EVENT_IMMUTABLE')
  })
})

/**
 * The lifecycle rules the contract grew after Phase 1 shipped.
 *
 * Each one exists because the frontend now offers the operation, and the UI
 * hiding an impossible button is not the same as the API refusing it: the
 * status on screen was read in the past, and the lazy `published` -> `finished`
 * promotion moves it with nobody clicking anything.
 */
describe('event lifecycle rules', () => {
  it('409 EVENT_IMMUTABLE on PATCH of a cancelled event', async () => {
    const error = await expectApiError(
      apiFetch(`/api/v1/events/${EVENT_IDS.cancelled}`, {
        method: 'PATCH',
        body: { title: 'Trying to revive it' },
      }),
    )

    expect(error.status).toBe(409)
    expect(error.code).toBe('EVENT_IMMUTABLE')
  })

  it('409 EVENT_IMMUTABLE on PATCH of a finished event', async () => {
    const error = await expectApiError(
      apiFetch(`/api/v1/events/${EVENT_IDS.finished}`, {
        method: 'PATCH',
        body: { title: 'Rewriting history' },
      }),
    )

    expect(error.status).toBe(409)
    expect(error.code).toBe('EVENT_IMMUTABLE')
  })

  it('422 on ends_at when a published event is moved into the past', async () => {
    // Closing an event early is not a supported operation — an event finishes
    // when its check-in window closes, and PATCH is not the back door to it.
    const error = await expectApiError(
      apiFetch(`/api/v1/events/${EVENT_IDS.published}`, {
        method: 'PATCH',
        body: { ends_at: new Date(Date.now() - DAY).toISOString() },
      }),
    )

    expect(error.status).toBe(422)
    expect(error.code).toBe('VALIDATION_ERROR')

    // Read through the same parser the form uses, so the mock is proven to
    // answer in the shape the UI actually consumes.
    const fields = readFieldErrors(error)
    expect(fields).toHaveLength(1)
    expect(fields[0].field).toBe('ends_at')
    expect(fields[0].message).toContain('past')
  })

  it('accepts moving ends_at further into the future on a published event', async () => {
    const later = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()

    const updated = await apiFetch<Event>(`/api/v1/events/${EVENT_IDS.published}`, {
      method: 'PATCH',
      body: { ends_at: later },
    })

    expect(updated.ends_at).toBe(later)
    expect(updated.status).toBe('published')
  })

  it('409 EVENT_IMMUTABLE on DELETE of a finished event', async () => {
    const error = await expectApiError(
      apiFetch(`/api/v1/events/${EVENT_IDS.finished}`, { method: 'DELETE' }),
    )

    expect(error.status).toBe(409)
    expect(error.code).toBe('EVENT_IMMUTABLE')
  })

  it('409 EVENT_IMMUTABLE on DELETE of an event the lazy transition finished', async () => {
    // Seeded three days back, so the live event's window closed long ago and
    // nothing has touched the record since. The DELETE itself must notice.
    resetDb(Date.now() - 3 * DAY)

    const error = await expectApiError(
      apiFetch(`/api/v1/events/${EVENT_IDS.published}`, { method: 'DELETE' }),
    )

    expect(error.status).toBe(409)
    expect(error.code).toBe('EVENT_IMMUTABLE')
  })

  it('409 EVENT_IMMUTABLE on DELETE of an already cancelled event', async () => {
    const error = await expectApiError(
      apiFetch(`/api/v1/events/${EVENT_IDS.cancelled}`, { method: 'DELETE' }),
    )

    expect(error.status).toBe(409)
    expect(error.code).toBe('EVENT_IMMUTABLE')
  })

  it('cancels a draft event and revokes its valid tickets', async () => {
    await expect(
      apiFetch(`/api/v1/events/${EVENT_IDS.draft}`, { method: 'DELETE' }),
    ).resolves.toBeUndefined()

    const event = await apiFetch<Event>(`/api/v1/events/${EVENT_IDS.draft}`)

    expect(event.status).toBe('cancelled')
    // `tickets_issued` counts non-revoked tickets, so the soft delete empties it.
    expect(event.tickets_issued).toBe(0)
  })
})

describe('mock database consistency', () => {
  it('a successful check-in raises checked_in_count and flips the ticket status', async () => {
    const before = await apiFetch<Event>(`/api/v1/events/${EVENT_IDS.published}`)

    const result = await checkIn(EVENT_IDS.published, DEV_TOKENS.valid)

    expect(result.ticket.status).toBe('checked_in')
    expect(result.event_stats.checked_in_count).toBe(before.checked_in_count + 1)
    expect(result.event_stats.tickets_issued).toBe(before.tickets_issued)

    const after = await apiFetch<Event>(`/api/v1/events/${EVENT_IDS.published}`)
    expect(after.checked_in_count).toBe(before.checked_in_count + 1)

    // Scanning the same token again is now the "already used" branch.
    const error = await expectApiError(checkIn(EVENT_IDS.published, DEV_TOKENS.valid))
    expect(error.code).toBe('TICKET_ALREADY_CHECKED_IN')
  })

  it('issuing tickets raises tickets_issued and returns tokens only once', async () => {
    const before = await apiFetch<Event>(`/api/v1/events/${EVENT_IDS.draft}`)

    const issued = await apiFetch<TicketBatchResponse>(
      `/api/v1/events/${EVENT_IDS.draft}/tickets`,
      { method: 'POST', body: { attendees: [{ attendee_name: 'Nova Pessoa' }] } },
    )

    expect(issued.items).toHaveLength(1)
    expect(issued.items[0].qr_payload).toBe(`EVCK1:${issued.items[0].qr_token}`)

    const after = await apiFetch<Event>(`/api/v1/events/${EVENT_IDS.draft}`)
    expect(after.tickets_issued).toBe(before.tickets_issued + 1)
  })

  it('rejects a batch that would exceed the event capacity', async () => {
    const attendees = Array.from({ length: 500 }, (_, index) => ({
      attendee_name: `Attendee ${index}`,
    }))

    const error = await expectApiError(
      apiFetch(`/api/v1/events/${EVENT_IDS.draft}/tickets`, {
        method: 'POST',
        body: { attendees },
      }),
    )

    expect(error.status).toBe(409)
    expect(error.code).toBe('EVENT_CAPACITY_EXCEEDED')
  })
})
