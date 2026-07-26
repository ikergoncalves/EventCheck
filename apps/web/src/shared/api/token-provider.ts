/**
 * Injectable access-token provider.
 *
 * Phase 1 ships a stub that returns a fake token so the HTTP client can be
 * exercised end to end against the mocks. Phase 2 replaces it with the real
 * Supabase session by calling `setTokenProvider` once during bootstrap —
 * nothing else in the codebase needs to change.
 */

export type TokenProvider = () => string | null | Promise<string | null>

/**
 * Obviously fake, and shaped like a JWT only so `Authorization` headers look
 * realistic while the backend does not exist yet.
 */
export const STUB_ACCESS_TOKEN = 'phase1-stub-token.not-a-real-jwt.do-not-trust'

const stubTokenProvider: TokenProvider = () => STUB_ACCESS_TOKEN

let currentTokenProvider: TokenProvider = stubTokenProvider

/** Swap the token source. Phase 2 wires the real session in here. */
export function setTokenProvider(provider: TokenProvider): void {
  currentTokenProvider = provider
}

/** Restore the Phase 1 stub. Used by tests. */
export function resetTokenProvider(): void {
  currentTokenProvider = stubTokenProvider
}

export async function getAccessToken(): Promise<string | null> {
  return await currentTokenProvider()
}
