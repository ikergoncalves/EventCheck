/**
 * Injectable authentication client.
 *
 * The same seam as `shared/api/token-provider.ts`, for the same reason: the
 * test suite must never open a socket to a real Supabase project, and MSW
 * cannot help here because Supabase's SDK is not something we want to
 * re-implement handler by handler. So the app depends on this narrow interface,
 * the default implementation delegates to the real SDK, and tests swap in a
 * fake with `setAuthClient()`.
 *
 * The interface is deliberately smaller than Supabase's: five operations, each
 * returning a shape this app defines. That keeps `AuthError` — whose text is
 * written for developers and occasionally leaks server detail — from ever
 * reaching a component.
 */
import type { AuthError, Session } from '@supabase/supabase-js'
import { SupabaseConfigError, getSupabaseClient } from './supabase-client'

/**
 * Failure modes this app distinguishes.
 *
 * Closed union on purpose: `auth-errors.ts` switches over it exhaustively, so
 * a new code cannot be introduced without also giving it a sentence.
 */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_CONFIRMED'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'WEAK_PASSWORD'
  | 'SIGNUP_DISABLED'
  | 'RATE_LIMITED'
  | 'NOT_CONFIGURED'
  | 'UNAVAILABLE'

export interface Credentials {
  email: string
  password: string
}

/**
 * The result of a sign-in or sign-up.
 *
 * `ok` with a `null` session is not a contradiction: a project that requires
 * e-mail confirmation accepts the sign-up and withholds the session until the
 * link is clicked. The caller has to render that as its own state.
 */
export type AuthOutcome = { ok: true; session: Session | null } | { ok: false; code: AuthErrorCode }

/** Called whenever the session changes, including on token refresh. */
export type AuthStateListener = (session: Session | null) => void

/*
 * Function-typed properties rather than methods: implementations are plain
 * object literals with no `this`, and callers routinely pull them apart.
 */
export interface AuthClient {
  /** The persisted session, or `null`. Restored from storage on boot. */
  getSession: () => Promise<Session | null>
  /** Subscribes to session changes; the returned function unsubscribes. */
  onAuthStateChange: (listener: AuthStateListener) => () => void
  signIn: (credentials: Credentials) => Promise<AuthOutcome>
  signUp: (credentials: Credentials) => Promise<AuthOutcome>
  signOut: () => Promise<void>
}

/* -------------------------------------------------------------------------- */
/* Supabase error translation                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Maps a Supabase `AuthError` onto this app's closed union.
 *
 * Matching is on `error.code`, the machine-readable field, never on the
 * message. Anything unrecognized degrades to `UNAVAILABLE` rather than being
 * forwarded verbatim — the raw text is for logs, not for the organizer.
 */
function toAuthErrorCode(error: AuthError): AuthErrorCode {
  switch (error.code) {
    case 'invalid_credentials':
      return 'INVALID_CREDENTIALS'
    case 'email_not_confirmed':
      return 'EMAIL_NOT_CONFIRMED'
    case 'user_already_exists':
    case 'email_exists':
      return 'EMAIL_ALREADY_REGISTERED'
    case 'weak_password':
      return 'WEAK_PASSWORD'
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'SIGNUP_DISABLED'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'RATE_LIMITED'
    default:
      // Older SDK responses carry the status but no code.
      if (error.status === 400 || error.status === 401) return 'INVALID_CREDENTIALS'
      if (error.status === 429) return 'RATE_LIMITED'
      return 'UNAVAILABLE'
  }
}

/* -------------------------------------------------------------------------- */
/* Default implementation                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Runs an operation against the real SDK, turning a missing configuration into
 * a regular failed outcome instead of a thrown error.
 */
async function withClient<T>(
  operation: (client: ReturnType<typeof getSupabaseClient>) => Promise<T>,
  onNotConfigured: () => T,
): Promise<T> {
  try {
    return await operation(getSupabaseClient())
  } catch (error) {
    if (error instanceof SupabaseConfigError) return onNotConfigured()
    throw error
  }
}

const supabaseAuthClient: AuthClient = {
  async getSession() {
    const { data } = await getSupabaseClient().auth.getSession()
    return data.session
  },

  onAuthStateChange(listener) {
    const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      listener(session)
    })
    return () => {
      data.subscription.unsubscribe()
    }
  },

  async signIn({ email, password }) {
    return await withClient<AuthOutcome>(
      async (client) => {
        const { data, error } = await client.auth.signInWithPassword({ email, password })
        if (error) return { ok: false, code: toAuthErrorCode(error) }
        return { ok: true, session: data.session }
      },
      () => ({ ok: false, code: 'NOT_CONFIGURED' }),
    )
  },

  async signUp({ email, password }) {
    return await withClient<AuthOutcome>(
      async (client) => {
        const { data, error } = await client.auth.signUp({ email, password })
        if (error) return { ok: false, code: toAuthErrorCode(error) }
        // `session` is null when the project requires e-mail confirmation.
        return { ok: true, session: data.session }
      },
      () => ({ ok: false, code: 'NOT_CONFIGURED' }),
    )
  },

  async signOut() {
    await getSupabaseClient().auth.signOut()
  },
}

/* -------------------------------------------------------------------------- */
/* The seam                                                                    */
/* -------------------------------------------------------------------------- */

let currentAuthClient: AuthClient = supabaseAuthClient

/** Swaps the authentication client. Tests use this; the app never does. */
export function setAuthClient(client: AuthClient): void {
  currentAuthClient = client
}

/** Restores the real Supabase-backed client. */
export function resetAuthClient(): void {
  currentAuthClient = supabaseAuthClient
}

export function getAuthClient(): AuthClient {
  return currentAuthClient
}
