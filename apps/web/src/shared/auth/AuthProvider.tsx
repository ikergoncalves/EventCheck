/**
 * Holds the Supabase session and publishes it to the rest of the app.
 *
 * Two wiring details carry most of the weight here.
 *
 * The first is `setTokenProvider`. Phase 1 built the HTTP client around an
 * injectable token source precisely so that plugging in real authentication
 * would be a single line rather than a refactor — `http.ts` is untouched by
 * this phase, and the session reaches every request through that one call.
 *
 * The second is clearing the TanStack Query cache on sign-out. The cache is
 * keyed by resource, not by organizer, so without an explicit clear the next
 * person to sign in on the same browser would see the previous one's events
 * rendered from cache before their own request came back.
 *
 * Must be mounted inside `QueryClientProvider`.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { setTokenProvider } from '../api/token-provider'
import { type AuthOutcome, type Credentials, getAuthClient } from './auth-client'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'
import { SupabaseConfigError } from './supabase-client'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [configError, setConfigError] = useState<string | null>(null)

  /* ---------------------------------------------------------------------- */
  /* Restore on mount, then follow every change                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let active = true
    let sawEvent = false
    let unsubscribe = (): void => {}

    const apply = (next: Session | null): void => {
      setSession(next)
      setStatus(next === null ? 'anonymous' : 'authenticated')
    }

    const fail = (error: unknown): void => {
      if (error instanceof SupabaseConfigError) {
        setConfigError(error.message)
      } else {
        console.error('Could not restore the Supabase session.', error)
      }
      // Either way the app is usable and simply has nobody signed in; staying
      // on `loading` would hang every guarded route behind a spinner forever.
      apply(null)
    }

    try {
      const client = getAuthClient()

      // Subscribe before restoring, so a sign-in that lands mid-restore is not
      // missed. The SDK also replays the initial session through this channel.
      unsubscribe = client.onAuthStateChange((next) => {
        if (!active) return
        sawEvent = true
        apply(next)
      })

      void client.getSession().then(
        (restored) => {
          // A live event always wins over the snapshot we asked for earlier.
          if (active && !sawEvent) apply(restored)
        },
        (error: unknown) => {
          if (active) fail(error)
        },
      )
    } catch (error) {
      fail(error)
    }

    return () => {
      active = false
      unsubscribe()
      // Leave no token behind for a request fired after the app tore down.
      setTokenProvider(() => null)
    }
  }, [])

  /* ---------------------------------------------------------------------- */
  /* The one line that connects authentication to the HTTP layer             */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    setTokenProvider(() => session?.access_token ?? null)
  }, [session])

  /* ---------------------------------------------------------------------- */
  /* Actions                                                                 */
  /* ---------------------------------------------------------------------- */

  const signIn = useCallback(async (credentials: Credentials): Promise<AuthOutcome> => {
    const outcome = await getAuthClient().signIn(credentials)
    // Adopt the session immediately rather than waiting for the subscription:
    // the caller navigates on the returned outcome, and the guard it lands on
    // must not still read `anonymous`.
    if (outcome.ok && outcome.session !== null) {
      setSession(outcome.session)
      setStatus('authenticated')
    }
    return outcome
  }, [])

  const signUp = useCallback(async (credentials: Credentials): Promise<AuthOutcome> => {
    const outcome = await getAuthClient().signUp(credentials)
    // A project that requires e-mail confirmation returns no session here; the
    // caller renders that as its own state instead of navigating.
    if (outcome.ok && outcome.session !== null) {
      setSession(outcome.session)
      setStatus('authenticated')
    }
    return outcome
  }, [])

  const signOut = useCallback(async (): Promise<void> => {
    await getAuthClient().signOut()
    // Drop the previous organizer's data before anything can re-render with it.
    queryClient.clear()
    setSession(null)
    setStatus('anonymous')
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      status,
      configError,
      signIn,
      signUp,
      signOut,
    }),
    [session, status, configError, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
