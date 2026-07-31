/** Where a signed-in organizer belongs when no particular page was requested. */
export const DEFAULT_AUTHENTICATED_ROUTE = '/events'

/**
 * Reads the route `RequireAuth` stashed in the navigation state.
 *
 * The value only ever comes from our own `Navigate`, but it is still validated
 * as a local absolute path: navigation state is trivially forgeable from the
 * console, and turning it into an open redirect for the price of one missing
 * check is not a trade worth making. `//host` counts as protocol-relative, so
 * it is rejected too.
 */
export function readIntendedRoute(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return DEFAULT_AUTHENTICATED_ROUTE
  }

  const { from } = state
  if (typeof from !== 'string') return DEFAULT_AUTHENTICATED_ROUTE
  if (!from.startsWith('/') || from.startsWith('//')) return DEFAULT_AUTHENTICATED_ROUTE

  return from
}
