/**
 * Seed data for the mock API.
 *
 * Timestamps are derived from the moment the database is seeded rather than
 * hard-coded, so the published event is always "happening right now" no matter
 * when someone runs the app. That keeps the check-in timeline and the peak
 * window meaningful instead of drifting into the past.
 */
import type { CheckIn, Event, Organizer, Ticket } from '../shared/api/types'

/** A ticket plus the token the real backend only ever stores hashed. */
export interface TicketRecord extends Ticket {
  qr_token: string
}

/** Counters are derived from tickets, never stored, so they cannot drift. */
export type EventRecord = Omit<Event, 'tickets_issued' | 'checked_in_count'>

export interface Database {
  organizer: Organizer
  events: EventRecord[]
  tickets: TicketRecord[]
  checkIns: CheckIn[]
}

/* -------------------------------------------------------------------------- */
/* Fixed identifiers                                                           */
/* -------------------------------------------------------------------------- */

export const ORGANIZER_ID = '00000000-0000-4000-8000-000000000001'

export const EVENT_IDS = {
  draft: '11111111-1111-4111-8111-111111111111',
  published: '22222222-2222-4222-8222-222222222222',
  finished: '33333333-3333-4333-8333-333333333333',
  cancelled: '44444444-4444-4444-8444-444444444444',
} as const

/**
 * Tokens wired to a specific outcome so every check-in branch of the contract
 * can be triggered on purpose during development. All are 32 characters, the
 * contract's minimum for `qr_token`.
 *
 * Documented in apps/web/README.md — keep the two in sync.
 */
export const DEV_TOKENS = {
  /** Valid ticket on the published event → 201. */
  valid: 'devValidTicketToken0000000000000',
  /** Not in the database → 404 TICKET_NOT_FOUND. */
  unknown: 'devUnknownTicketToken00000000000',
  /** Already used → 409 TICKET_ALREADY_CHECKED_IN, original check-in in details. */
  alreadyCheckedIn: 'devAlreadyCheckedInToken00000000',
  /** Revoked ticket → 409 TICKET_REVOKED. */
  revoked: 'devRevokedTicketToken00000000000',
  /** Belongs to the draft event → 409 TICKET_WRONG_EVENT. */
  wrongEvent: 'devWrongEventTicketToken00000000',
  /** Valid ticket on the finished event → 409 EVENT_NOT_ACTIVE. */
  eventNotActive: 'devFinishedEventTicketToken00000',
} as const

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const iso = (epochMs: number): string => new Date(epochMs).toISOString()

/* -------------------------------------------------------------------------- */
/* Attendees                                                                   */
/* -------------------------------------------------------------------------- */

const ATTENDEE_NAMES = [
  'Ana Souza',
  'Bruno Carvalho',
  'Carla Nogueira',
  'Diego Martins',
  'Elisa Fontes',
  'Felipe Ramos',
  'Gabriela Lima',
  'Henrique Alves',
  'Isabela Pires',
  'João Vitor Teixeira',
  'Karina Duarte',
  'Lucas Ferreira',
  'Mariana Castro',
  'Nicolas Barbosa',
  'Olívia Mendes',
  'Paulo Henrique Rocha',
  'Queila Santana',
  'Rafael Moreira',
  'Sofia Cardoso',
  'Thiago Barros',
  'Ursula Amaral',
  'Vinícius Prado',
  'Wesley Antunes',
  'Xênia Vasconcelos',
  'Yuri Campos',
  'Zélia Monteiro',
  'Alice Berger',
  'Caio Tavares',
  'Débora Nunes',
  'Eduardo Pacheco',
  'Fernanda Quintana',
  'Gustavo Leal',
  'Helena Rios',
  'Igor Bastos',
  'Juliana Peixoto',
  'Kleber Andrade',
  'Larissa Sales',
  'Marcelo Vieira',
  'Natália Freitas',
  'Otávio Guimarães',
] as const

const TIERS = ['Standard', 'VIP', 'Staff'] as const

const slugify = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '')

/** Deterministic, 32-character, base64url-ish token for seeded tickets. */
function seededToken(prefix: string, index: number): string {
  const base = `${prefix}${String(index).padStart(3, '0')}`
  return base.padEnd(32, '0').slice(0, 32)
}

function uuid(prefix: string, index: number): string {
  const tail = String(index).padStart(12, '0')
  return `${prefix}-0000-4000-8000-${tail}`
}

/* -------------------------------------------------------------------------- */
/* Seed                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Builds a fresh database. Called on boot and by `resetDb()` between tests, so
 * it must never return shared references.
 */
export function seedDatabase(now: number = Date.now()): Database {
  const organizer: Organizer = {
    id: ORGANIZER_ID,
    email: 'organizer@eventcheck.dev',
    display_name: 'Iker Gonçalves',
    created_at: iso(now - 180 * DAY),
  }

  // The published event is mid-flight: doors opened two hours ago.
  const publishedStart = now - 2 * HOUR
  const publishedEnd = now + 2 * HOUR

  const events: EventRecord[] = [
    {
      id: EVENT_IDS.published,
      organizer_id: ORGANIZER_ID,
      title: 'React Summit Brasil 2026',
      description:
        'Full-day conference on the modern React ecosystem, with hands-on tracks in the afternoon.',
      starts_at: iso(publishedStart),
      ends_at: iso(publishedEnd),
      timezone: 'America/Sao_Paulo',
      venue_name: 'Centro de Convenções Rebouças',
      address: 'Av. Rebouças, 600 — Pinheiros, São Paulo',
      capacity: 60,
      status: 'published',
      created_at: iso(now - 45 * DAY),
      updated_at: iso(now - 2 * HOUR),
    },
    {
      id: EVENT_IDS.draft,
      organizer_id: ORGANIZER_ID,
      title: 'Workshop: QR Code na portaria',
      description: 'Hands-on session on ticket issuing and door operations.',
      starts_at: iso(now + 42 * DAY),
      ends_at: iso(now + 42 * DAY + 4 * HOUR),
      timezone: 'America/Sao_Paulo',
      venue_name: null,
      address: null,
      capacity: 30,
      status: 'draft',
      created_at: iso(now - 5 * DAY),
      updated_at: iso(now - 5 * DAY),
    },
    {
      id: EVENT_IDS.finished,
      organizer_id: ORGANIZER_ID,
      title: 'Meetup Frontend SP — Edição de Junho',
      description: 'Three lightning talks and open networking.',
      starts_at: iso(now - 44 * DAY),
      ends_at: iso(now - 44 * DAY + 4 * HOUR),
      timezone: 'America/Sao_Paulo',
      venue_name: 'Espaço Coletivo',
      address: 'R. Augusta, 1500 — Consolação, São Paulo',
      capacity: 80,
      status: 'finished',
      created_at: iso(now - 90 * DAY),
      updated_at: iso(now - 44 * DAY),
    },
    {
      id: EVENT_IDS.cancelled,
      organizer_id: ORGANIZER_ID,
      title: 'Hackathon EventCheck (adiado)',
      description: null,
      starts_at: iso(now + 70 * DAY),
      ends_at: iso(now + 72 * DAY),
      timezone: 'America/Fortaleza',
      venue_name: 'Hub Criativo',
      address: null,
      capacity: 120,
      status: 'cancelled',
      created_at: iso(now - 20 * DAY),
      updated_at: iso(now - 3 * DAY),
    },
  ]

  const tickets: TicketRecord[] = []
  const checkIns: CheckIn[] = []

  /*
   * Published event: 40 tickets — 24 checked in, 13 still valid, 3 revoked.
   * Derived counters therefore land on tickets_issued = 37, checked_in = 24.
   */
  const CHECKED_IN_COUNT = 24
  const REVOKED_COUNT = 3

  ATTENDEE_NAMES.forEach((name, index) => {
    const isRevoked = index >= ATTENDEE_NAMES.length - REVOKED_COUNT
    const isCheckedIn = !isRevoked && index < CHECKED_IN_COUNT

    /*
     * Entries cluster in a 30-minute peak that opened 100 minutes ago: 16 of
     * the 24 arrivals land inside it, the rest trickle in before and after.
     */
    const peakStart = now - 100 * MINUTE
    const checkedInAt = isCheckedIn
      ? index < 4
        ? peakStart - (20 - index * 4) * MINUTE // early birds, before the rush
        : index < 20
          ? peakStart + (index - 4) * 2 * MINUTE // the rush itself
          : peakStart + 45 * MINUTE + (index - 20) * 7 * MINUTE // stragglers
      : null

    const ticket: TicketRecord = {
      id: uuid('a0000000', index + 1),
      event_id: EVENT_IDS.published,
      attendee_name: name,
      attendee_email: `${slugify(name)}@example.com`,
      tier: TIERS[index % TIERS.length],
      status: isRevoked ? 'revoked' : isCheckedIn ? 'checked_in' : 'valid',
      issued_at: iso(now - 30 * DAY + index * MINUTE),
      checked_in_at: checkedInAt === null ? null : iso(checkedInAt),
      qr_token: seededToken('pubTicket', index + 1),
    }

    tickets.push(ticket)

    if (checkedInAt !== null) {
      checkIns.push({
        id: uuid('c0000000', index + 1),
        ticket_id: ticket.id,
        event_id: EVENT_IDS.published,
        attendee_name: ticket.attendee_name,
        checked_in_at: iso(checkedInAt),
        device_label: index % 2 === 0 ? 'Portaria A' : 'Portaria B',
        operator_id: ORGANIZER_ID,
      })
    }
  })

  /* Scenario tickets with fixed tokens, so each error branch can be forced. */

  // Valid on the published event → happy path.
  tickets.push({
    id: uuid('b0000000', 1),
    event_id: EVENT_IDS.published,
    attendee_name: 'Dev Happy Path',
    attendee_email: 'dev.happy@example.com',
    tier: 'Standard',
    status: 'valid',
    issued_at: iso(now - 10 * DAY),
    checked_in_at: null,
    qr_token: DEV_TOKENS.valid,
  })

  // Already used → 409 TICKET_ALREADY_CHECKED_IN.
  const alreadyCheckedInAt = now - 95 * MINUTE
  tickets.push({
    id: uuid('b0000000', 2),
    event_id: EVENT_IDS.published,
    attendee_name: 'Dev Already Checked In',
    attendee_email: 'dev.already@example.com',
    tier: 'VIP',
    status: 'checked_in',
    issued_at: iso(now - 10 * DAY),
    checked_in_at: iso(alreadyCheckedInAt),
    qr_token: DEV_TOKENS.alreadyCheckedIn,
  })
  checkIns.push({
    id: uuid('d0000000', 2),
    ticket_id: uuid('b0000000', 2),
    event_id: EVENT_IDS.published,
    attendee_name: 'Dev Already Checked In',
    checked_in_at: iso(alreadyCheckedInAt),
    device_label: 'Portaria A',
    operator_id: ORGANIZER_ID,
  })

  // Revoked → 409 TICKET_REVOKED.
  tickets.push({
    id: uuid('b0000000', 3),
    event_id: EVENT_IDS.published,
    attendee_name: 'Dev Revoked',
    attendee_email: 'dev.revoked@example.com',
    tier: 'Standard',
    status: 'revoked',
    issued_at: iso(now - 10 * DAY),
    checked_in_at: null,
    qr_token: DEV_TOKENS.revoked,
  })

  // Belongs to the draft event → 409 TICKET_WRONG_EVENT when scanned elsewhere.
  tickets.push({
    id: uuid('b0000000', 4),
    event_id: EVENT_IDS.draft,
    attendee_name: 'Dev Wrong Event',
    attendee_email: 'dev.wrong@example.com',
    tier: 'Standard',
    status: 'valid',
    issued_at: iso(now - 4 * DAY),
    checked_in_at: null,
    qr_token: DEV_TOKENS.wrongEvent,
  })

  // Valid, but its event is over → 409 EVENT_NOT_ACTIVE.
  tickets.push({
    id: uuid('b0000000', 5),
    event_id: EVENT_IDS.finished,
    attendee_name: 'Dev Finished Event',
    attendee_email: 'dev.finished@example.com',
    tier: 'Standard',
    status: 'valid',
    issued_at: iso(now - 50 * DAY),
    checked_in_at: null,
    qr_token: DEV_TOKENS.eventNotActive,
  })

  /* Finished event: a small, fully resolved attendance history. */
  const finishedStart = now - 44 * DAY
  for (let index = 0; index < 18; index += 1) {
    const attended = index < 12
    const checkedInAt = finishedStart - 15 * MINUTE + index * 3 * MINUTE
    const ticketId = uuid('e0000000', index + 1)

    tickets.push({
      id: ticketId,
      event_id: EVENT_IDS.finished,
      attendee_name: ATTENDEE_NAMES[index],
      attendee_email: `${slugify(ATTENDEE_NAMES[index])}@example.com`,
      tier: index % 4 === 0 ? 'VIP' : 'Standard',
      status: attended ? 'checked_in' : 'valid',
      issued_at: iso(now - 60 * DAY),
      checked_in_at: attended ? iso(checkedInAt) : null,
      qr_token: seededToken('finTicket', index + 1),
    })

    if (attended) {
      checkIns.push({
        id: uuid('f0000000', index + 1),
        ticket_id: ticketId,
        event_id: EVENT_IDS.finished,
        attendee_name: ATTENDEE_NAMES[index],
        checked_in_at: iso(checkedInAt),
        device_label: 'Portaria única',
        operator_id: ORGANIZER_ID,
      })
    }
  }

  return { organizer, events, tickets, checkIns }
}
