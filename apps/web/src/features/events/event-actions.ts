/**
 * Which lifecycle actions a status allows.
 *
 * These predicates decide what the UI *offers*. They are not what makes the
 * rules true — the contract is, and the server enforces it. The status on
 * screen was read at some point in the past, and two things can have moved it
 * since: another tab, or the contract's lazy `published` -> `finished`
 * transition, which happens on the next read or write with nobody clicking
 * anything. So every caller still handles the 409 it is trying to avoid.
 *
 * @see docs/api-contract/openapi.yaml — components.schemas.EventStatus
 */
import type { EventStatus } from '../../shared/api/types'

/** `finished` and `cancelled` are terminal: PATCH answers 409 EVENT_IMMUTABLE. */
export function isEditable(status: EventStatus): boolean {
  return status === 'draft' || status === 'published'
}

/** Publishing is the single `draft` -> `published` transition. */
export function isPublishable(status: EventStatus): boolean {
  return status === 'draft'
}

/**
 * Cancelling is the soft delete, and it revokes every valid ticket.
 *
 * A `finished` event refuses it: cancelling something that already happened
 * would revoke the tickets of people who actually walked through the door.
 */
export function isCancellable(status: EventStatus): boolean {
  return status === 'draft' || status === 'published'
}
