/**
 * A stand-in for the Supabase auth client.
 *
 * The test suite must never reach a real Supabase project — that is the point
 * of `setAuthClient`. MSW cannot cover this: the SDK is not a handful of REST
 * calls we could reimplement as handlers, and `onUnhandledRequest: 'error'`
 * would only tell us after the fact that something escaped. Swapping the
 * client out means there is nothing to escape from in the first place.
 *
 * The fake also exposes what the real one cannot: a session restore that never
 * settles, which is the only way to observe `status === 'loading'` — the state
 * the route guard exists to respect.
 */
import type { Session, User } from '@supabase/supabase-js'
import {
  type AuthClient,
  type AuthOutcome,
  type AuthStateListener,
  setAuthClient,
} from '../shared/auth/auth-client'
import { ORGANIZER_ID } from '../mocks/fixtures'

/** A session shaped like Supabase's, with the fields this app reads. */
export function makeSession(
  overrides: { email?: string; accessToken?: string; userId?: string } = {},
): Session {
  const user: User = {
    id: overrides.userId ?? ORGANIZER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: overrides.email ?? 'organizer@eventcheck.dev',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }

  return {
    access_token: overrides.accessToken ?? 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  }
}

export interface FakeAuthClient extends AuthClient {
  /** Pushes a session change through the subscription, as the SDK would. */
  emit(session: Session | null): void
  /** How many listeners are still subscribed — 0 after a clean unmount. */
  listenerCount(): number
  signOutCalls: number
  signInCalls: { email: string; password: string }[]
  signUpCalls: { email: string; password: string }[]
}

export interface FakeAuthOptions {
  /** The session `getSession()` restores. Defaults to none. */
  initialSession?: Session | null
  /**
   * Leaves the restore pending forever, pinning the provider on `loading`.
   * The guard must render rather than redirect while this holds.
   */
  pendingRestore?: boolean
  /** What `signIn` answers. Defaults to succeeding with a fresh session. */
  signInResult?: AuthOutcome | (() => AuthOutcome)
  /** What `signUp` answers. Defaults to succeeding with a fresh session. */
  signUpResult?: AuthOutcome | (() => AuthOutcome)
}

export function createFakeAuthClient(options: FakeAuthOptions = {}): FakeAuthClient {
  const { initialSession = null, pendingRestore = false } = options

  const listeners = new Set<AuthStateListener>()

  const resolve = (result: AuthOutcome | (() => AuthOutcome) | undefined): AuthOutcome =>
    typeof result === 'function' ? result() : (result ?? { ok: true, session: makeSession() })

  const client: FakeAuthClient = {
    signOutCalls: 0,
    signInCalls: [],
    signUpCalls: [],

    getSession() {
      // A promise that never settles is exactly a restore still in flight.
      if (pendingRestore) return new Promise<Session | null>(() => {})
      return Promise.resolve(initialSession)
    },

    onAuthStateChange(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    signIn(credentials) {
      client.signInCalls.push(credentials)
      return Promise.resolve(resolve(options.signInResult))
    },

    signUp(credentials) {
      client.signUpCalls.push(credentials)
      return Promise.resolve(resolve(options.signUpResult))
    },

    signOut() {
      client.signOutCalls += 1
      return Promise.resolve()
    },

    emit(session) {
      for (const listener of listeners) listener(session)
    },

    listenerCount() {
      return listeners.size
    },
  }

  return client
}

/** Creates the fake and installs it. Replaced between tests — see setup. */
export function installFakeAuthClient(options: FakeAuthOptions = {}): FakeAuthClient {
  const client = createFakeAuthClient(options)
  setAuthClient(client)
  return client
}

/**
 * The client the suite falls back to, installed before and after every test.
 *
 * Without it, a test that mounts `AuthProvider` and forgets to install a fake
 * would fall through to the real Supabase SDK. Today that only fails on a
 * missing configuration, but the moment someone puts real credentials in their
 * `.env.local` the same test would quietly open a socket to a live project —
 * and `onUnhandledRequest: 'error'` cannot catch what the SDK does outside
 * `fetch`. So the fallback is a client that cannot do anything at all, which
 * makes "the tests do not reach the network" a property of the wiring rather
 * than of everyone remembering.
 */
export function installForbiddenAuthClient(): void {
  const refuse = (): never => {
    throw new Error(
      'No auth client installed. Call installFakeAuthClient() before rendering AuthProvider.',
    )
  }

  setAuthClient({
    getSession: refuse,
    onAuthStateChange: refuse,
    signIn: refuse,
    signUp: refuse,
    signOut: refuse,
  })
}
