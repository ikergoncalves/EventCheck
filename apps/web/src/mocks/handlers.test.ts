/**
 * Guards the two properties the mock layer exists to provide: the fixed dev
 * tokens really do trigger their contract error, and mutations keep the
 * counters consistent across calls.
 */
import { describe, expect, it } from 'vitest'
import { apiFetch } from '../shared/api/http'
import type { CheckInResult, Event, TicketBatchResponse } from '../shared/api/types'
import { expectApiError } from '../test/api'
import { DEV_TOKENS, EVENT_IDS } from './fixtures'

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
