/**
 * In-memory database behind the mock API.
 *
 * State is consistent across calls: issuing tickets moves `tickets_issued`,
 * a check-in moves `checked_in_count` and the ticket's status. Counters are
 * always derived from the ticket table rather than stored, which is what makes
 * that consistency structural instead of something handlers must remember.
 */
import type {
  CheckIn,
  Event,
  EventStats,
  EventStatus,
  Ticket,
  TicketStatus,
  TimelineBucket,
} from '../shared/api/types'
import { type Database, type EventRecord, type TicketRecord, seedDatabase } from './fixtures'

let db: Database = seedDatabase()

/** Rebuilds the seed state. Called between tests to keep them independent. */
export function resetDb(now?: number): void {
  db = seedDatabase(now)
}

export function getOrganizer() {
  return db.organizer
}

/* -------------------------------------------------------------------------- */
/* Derived counters                                                            */
/* -------------------------------------------------------------------------- */

function ticketsOf(eventId: string): TicketRecord[] {
  return db.tickets.filter((ticket) => ticket.event_id === eventId)
}

/** The contract defines `tickets_issued` as the count of non-revoked tickets. */
function countIssued(eventId: string): number {
  return ticketsOf(eventId).filter((ticket) => ticket.status !== 'revoked').length
}

function countCheckedIn(eventId: string): number {
  return ticketsOf(eventId).filter((ticket) => ticket.status === 'checked_in').length
}

/** Projects a stored record into the contract's `Event` shape. */
export function toEvent(record: EventRecord): Event {
  return {
    ...record,
    tickets_issued: countIssued(record.id),
    checked_in_count: countCheckedIn(record.id),
  }
}

/** Strips the token: only issue and reissue may expose it. */
export function toTicket(record: TicketRecord): Ticket {
  const { qr_token: _qrToken, ...ticket } = record
  return ticket
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export function findEvent(eventId: string): EventRecord | undefined {
  return db.events.find((event) => event.id === eventId)
}

export function findTicket(ticketId: string): TicketRecord | undefined {
  return db.tickets.find((ticket) => ticket.id === ticketId)
}

export function findTicketByToken(token: string): TicketRecord | undefined {
  return db.tickets.find((ticket) => ticket.qr_token === token)
}

export interface ListEventsOptions {
  status?: EventStatus[]
  search?: string
  sort?: 'starts_at' | '-starts_at' | 'created_at' | '-created_at'
}

export function listEvents(options: ListEventsOptions = {}): Event[] {
  const { status, search, sort = '-starts_at' } = options

  let result = db.events
  if (status && status.length > 0) result = result.filter((e) => status.includes(e.status))
  if (search) {
    const needle = search.toLowerCase()
    result = result.filter((e) => e.title.toLowerCase().includes(needle))
  }

  const descending = sort.startsWith('-')
  const field = (descending ? sort.slice(1) : sort) as 'starts_at' | 'created_at'

  return [...result]
    .sort((a, b) => {
      const delta = Date.parse(a[field]) - Date.parse(b[field])
      return descending ? -delta : delta
    })
    .map(toEvent)
}

export interface ListTicketsOptions {
  status?: TicketStatus[]
  search?: string
}

export function listTickets(eventId: string, options: ListTicketsOptions = {}): Ticket[] {
  const { status, search } = options

  let result = ticketsOf(eventId)
  if (status && status.length > 0) result = result.filter((t) => status.includes(t.status))
  if (search) {
    const needle = search.toLowerCase()
    result = result.filter(
      (t) =>
        t.attendee_name.toLowerCase().includes(needle) ||
        (t.attendee_email ?? '').toLowerCase().includes(needle),
    )
  }

  return result.map(toTicket)
}

export function listCheckIns(eventId: string, since?: string): CheckIn[] {
  let result = db.checkIns.filter((checkIn) => checkIn.event_id === eventId)

  if (since) {
    const threshold = Date.parse(since)
    result = result.filter((checkIn) => Date.parse(checkIn.checked_in_at) > threshold)
  }

  // Newest first, as the contract specifies.
  return [...result].sort((a, b) => Date.parse(b.checked_in_at) - Date.parse(a.checked_in_at))
}

export function findCheckInByTicket(ticketId: string): CheckIn | undefined {
  return db.checkIns.find((checkIn) => checkIn.ticket_id === ticketId)
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

let sequence = 1000

function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-0000-4000-8000-${String(sequence).padStart(12, '0')}`
}

function randomToken(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let token = ''
  for (let i = 0; i < 32; i += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return token
}

export function createEvent(input: {
  title: string
  description?: string | null
  starts_at: string
  ends_at: string
  timezone: string
  venue_name?: string | null
  address?: string | null
  capacity: number
}): Event {
  const now = new Date().toISOString()
  const record: EventRecord = {
    id: nextId('9a000000'),
    organizer_id: db.organizer.id,
    title: input.title,
    description: input.description ?? null,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    timezone: input.timezone,
    venue_name: input.venue_name ?? null,
    address: input.address ?? null,
    capacity: input.capacity,
    // The contract is explicit: an event is always born as a draft.
    status: 'draft',
    created_at: now,
    updated_at: now,
  }

  db.events.push(record)
  return toEvent(record)
}

export function updateEvent(record: EventRecord, patch: Partial<EventRecord>): Event {
  Object.assign(record, patch, { updated_at: new Date().toISOString() })
  return toEvent(record)
}

export function publishEvent(record: EventRecord): Event {
  record.status = 'published'
  record.updated_at = new Date().toISOString()
  return toEvent(record)
}

/** Soft delete: the event is cancelled and every valid ticket is revoked. */
export function cancelEvent(record: EventRecord): void {
  record.status = 'cancelled'
  record.updated_at = new Date().toISOString()

  for (const ticket of ticketsOf(record.id)) {
    if (ticket.status === 'valid') ticket.status = 'revoked'
  }
}

export function issueTickets(
  eventId: string,
  attendees: { attendee_name: string; attendee_email?: string | null; tier?: string | null }[],
): TicketRecord[] {
  const now = new Date().toISOString()

  const created = attendees.map<TicketRecord>((attendee) => ({
    id: nextId('9b000000'),
    event_id: eventId,
    attendee_name: attendee.attendee_name,
    attendee_email: attendee.attendee_email ?? null,
    tier: attendee.tier ?? null,
    status: 'valid',
    issued_at: now,
    checked_in_at: null,
    qr_token: randomToken(),
  }))

  // Transactional in the contract: all of them, or none.
  db.tickets.push(...created)
  return created
}

export function revokeTicket(ticket: TicketRecord): Ticket {
  ticket.status = 'revoked'
  return toTicket(ticket)
}

export function reissueTicket(ticket: TicketRecord): TicketRecord {
  ticket.qr_token = randomToken()
  return ticket
}

export function registerCheckIn(ticket: TicketRecord, deviceLabel?: string | null): CheckIn {
  const checkedInAt = new Date().toISOString()

  ticket.status = 'checked_in'
  ticket.checked_in_at = checkedInAt

  const checkIn: CheckIn = {
    id: nextId('9c000000'),
    ticket_id: ticket.id,
    event_id: ticket.event_id,
    attendee_name: ticket.attendee_name,
    checked_in_at: checkedInAt,
    device_label: deviceLabel ?? null,
    operator_id: db.organizer.id,
  }

  db.checkIns.push(checkIn)
  return checkIn
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

export function buildEventStats(eventId: string, bucketMinutes: number): EventStats {
  const record = findEvent(eventId)
  const tickets = ticketsOf(eventId)
  const checkIns = listCheckIns(eventId)

  const ticketsIssued = countIssued(eventId)
  const checkedInCount = countCheckedIn(eventId)
  const revokedCount = tickets.filter((t) => t.status === 'revoked').length

  const sorted = [...checkIns].sort(
    (a, b) => Date.parse(a.checked_in_at) - Date.parse(b.checked_in_at),
  )

  const bucketMs = bucketMinutes * 60_000
  const buckets = new Map<number, number>()
  for (const checkIn of sorted) {
    const bucketStart = Math.floor(Date.parse(checkIn.checked_in_at) / bucketMs) * bucketMs
    buckets.set(bucketStart, (buckets.get(bucketStart) ?? 0) + 1)
  }

  const timeline: TimelineBucket[] = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, count]) => ({
      bucket_start: new Date(bucketStart).toISOString(),
      count,
    }))

  const peak = timeline.reduce<TimelineBucket | null>(
    (best, bucket) => (best === null || bucket.count > best.count ? bucket : best),
    null,
  )

  return {
    event_id: eventId,
    tickets_issued: ticketsIssued,
    checked_in_count: checkedInCount,
    pending_count: tickets.filter((t) => t.status === 'valid').length,
    revoked_count: revokedCount,
    attendance_rate: ticketsIssued === 0 ? 0 : checkedInCount / ticketsIssued,
    capacity_usage: record && record.capacity > 0 ? ticketsIssued / record.capacity : 0,
    first_check_in_at: sorted.at(0)?.checked_in_at ?? null,
    last_check_in_at: sorted.at(-1)?.checked_in_at ?? null,
    peak_window:
      peak === null
        ? null
        : {
            starts_at: peak.bucket_start,
            ends_at: new Date(Date.parse(peak.bucket_start) + bucketMs).toISOString(),
            count: peak.count,
          },
    timeline,
  }
}

export function buildReportData(record: EventRecord) {
  const tickets = ticketsOf(record.id)
  const stats = buildEventStats(record.id, 15)

  const tierNames = [...new Set(tickets.map((ticket) => ticket.tier ?? null))]
  const tiers = tierNames.map((tier) => {
    const inTier = tickets.filter((ticket) => (ticket.tier ?? null) === tier)
    return {
      tier,
      issued: inTier.filter((ticket) => ticket.status !== 'revoked').length,
      checked_in: inTier.filter((ticket) => ticket.status === 'checked_in').length,
    }
  })

  const startsAt = Date.parse(record.starts_at)
  const minutesBeforeStart = tickets
    .filter((ticket) => ticket.checked_in_at)
    .map((ticket) => (startsAt - Date.parse(ticket.checked_in_at as string)) / 60_000)
    .sort((a, b) => a - b)

  const median = (values: number[]): number | null => {
    if (values.length === 0) return null
    const middle = Math.floor(values.length / 2)
    return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle]
  }

  return {
    event: {
      id: record.id,
      title: record.title,
      starts_at: record.starts_at,
      ends_at: record.ends_at,
      timezone: record.timezone,
      capacity: record.capacity,
      venue_name: record.venue_name ?? null,
    },
    stats,
    tiers,
    no_show_count: tickets.filter((ticket) => ticket.status === 'valid').length,
    median_minutes_before_start: median(minutesBeforeStart),
  }
}
