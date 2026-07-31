/**
 * The authentication context object and its type.
 *
 * Split out of `AuthProvider.tsx` so that file exports a component and nothing
 * else, which is what React Fast Refresh needs to keep its boundaries clean.
 */
import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { AuthOutcome, Credentials } from './auth-client'

/**
 * `loading` is the state a route guard must not act on.
 *
 * Restoring a persisted session is asynchronous, so on every page load there is
 * a moment where the app truly does not know yet. Collapsing that moment into
 * `anonymous` is what makes a protected page flash the login screen on refresh.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  status: AuthStatus
  /**
   * Set when the environment does not describe a Supabase project. The access
   * screens render this instead of a form: no credential would work anyway,
   * and "wrong password" would be a lie.
   */
  configError: string | null
  /*
   * Declared as function-typed properties rather than methods so destructuring
   * them out of `useAuth()` — which is how every caller uses them — is not
   * flagged as unbinding a method. They never rely on `this`.
   */
  signIn: (credentials: Credentials) => Promise<AuthOutcome>
  signUp: (credentials: Credentials) => Promise<AuthOutcome>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
