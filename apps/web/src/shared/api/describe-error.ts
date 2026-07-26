import { ApiError } from './http'
import type { ApiErrorCode } from './types'

/**
 * Turns an error into a sentence the organizer can act on.
 *
 * The `switch` is exhaustive over the contract's codes: adding a code to
 * `API_ERROR_CODES` without handling it here is a compile error, which is the
 * whole point of keeping `ApiError['code']` a literal union.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'We could not reach the server. Check your connection and try again.'
  }

  return messageForCode(error.code, error)
}

function messageForCode(code: ApiErrorCode, error: ApiError): string {
  switch (code) {
    case 'UNAUTHORIZED':
      return 'Your session has expired. Sign in again to continue.'
    case 'FORBIDDEN':
      return 'You do not have access to this resource.'
    case 'VALIDATION_ERROR':
      return 'Some of the submitted data is invalid.'
    case 'EVENT_NOT_FOUND':
      return 'This event does not exist, or it belongs to another organizer.'
    case 'EVENT_NOT_ACTIVE':
      return 'This event is not accepting check-ins right now.'
    case 'EVENT_IMMUTABLE':
      return 'This event can no longer be modified.'
    case 'EVENT_CAPACITY_EXCEEDED':
      return 'Issuing these tickets would exceed the event capacity.'
    case 'TICKET_NOT_FOUND':
      return 'No ticket matches this QR Code.'
    case 'TICKET_ALREADY_CHECKED_IN':
      return 'This ticket was already used.'
    case 'TICKET_REVOKED':
      return 'This ticket was revoked and is no longer valid.'
    case 'TICKET_WRONG_EVENT':
      return 'This ticket belongs to another event.'
    case 'RATE_LIMITED':
      return 'Too many requests. Wait a moment and try again.'
    case 'INTERNAL_ERROR':
      return 'The server had a problem. Try again in a few moments.'
    default: {
      // Exhaustiveness guard: `code` is `never` once every case is handled.
      const exhaustive: never = code
      void exhaustive
      return error.message
    }
  }
}
