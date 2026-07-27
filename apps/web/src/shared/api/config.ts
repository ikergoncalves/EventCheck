/**
 * Runtime API configuration.
 *
 * Both the HTTP client and the MSW handlers resolve their URLs from here, so
 * flipping `VITE_API_BASE_URL` moves the whole app to a real backend without
 * touching a single component.
 */

/** Matches the `Desenvolvimento local` server entry in the contract. */
const FALLBACK_API_BASE_URL = 'http://localhost:8000'

/** Base URL without a trailing slash. Paths are appended verbatim. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? FALLBACK_API_BASE_URL).replace(
  /\/+$/,
  '',
)

/** Version prefix every authenticated route carries in the contract. */
export const API_V1 = `${API_BASE_URL}/api/v1`
