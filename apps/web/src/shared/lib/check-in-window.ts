/**
 * The contract's check-in window, as pure functions.
 *
 * This is not a mock detail. The scanner needs the same rule to explain why a
 * read was refused before it ever reaches the network, so the logic lives here
 * and the MSW handlers consume it — one definition, two callers.
 *
 * Both functions take `now` as an argument and never read the clock
 * themselves, which is what makes them testable at the exact boundaries.
 *
 * @see docs/api-contract/openapi.yaml — "Janela de check-in"
 */
import type { Event, EventStatus } from '../api/types'

/** The window opens this many hours before `starts_at`. */
export const CHECK_IN_OPENS_BEFORE_START_HOURS = 12

/** The window closes this many hours after `ends_at`. */
export const CHECK_IN_CLOSES_AFTER_END_HOURS = 2

const HOUR_MS = 60 * 60 * 1000

/** The slice of an event the rule reads. Both records and payloads satisfy it. */
export type CheckInWindowEvent = Pick<Event, 'starts_at' | 'ends_at' | 'status'>

/** Epoch milliseconds at which the event starts accepting check-ins. */
export function checkInOpensAt(event: CheckInWindowEvent): number {
  return Date.parse(event.starts_at) - CHECK_IN_OPENS_BEFORE_START_HOURS * HOUR_MS
}

/** Epoch milliseconds at which the event stops accepting check-ins. */
export function checkInClosesAt(event: CheckInWindowEvent): number {
  return Date.parse(event.ends_at) + CHECK_IN_CLOSES_AFTER_END_HOURS * HOUR_MS
}

/**
 * Whether the event accepts check-ins at `now`.
 *
 * Both bounds are inclusive. The contract phrases the closing edge as
 * "`ends_at + 2h` já passou", so the instant itself is still inside the window
 * — which keeps this function and `resolveEventStatus` in agreement: an event
 * is `finished` exactly when its window has closed.
 */
export function isWithinCheckInWindow(event: CheckInWindowEvent, now: number): boolean {
  if (event.status !== 'published') return false
  return now >= checkInOpensAt(event) && now <= checkInClosesAt(event)
}

/**
 * The event's status at `now`, applying the contract's lazy transition.
 *
 * There is no scheduler in the project: a `published` event whose window has
 * closed becomes `finished` on the first read or write that touches it. Every
 * other status is terminal or not yet due, and is returned unchanged.
 */
export function resolveEventStatus(event: CheckInWindowEvent, now: number): EventStatus {
  if (event.status === 'published' && now > checkInClosesAt(event)) return 'finished'
  return event.status
}
