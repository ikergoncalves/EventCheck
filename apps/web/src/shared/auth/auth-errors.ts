/**
 * Sentences for the authentication failures the app distinguishes.
 *
 * The same discipline as `shared/api/describe-error.ts`: an exhaustive switch
 * over a closed union, so adding a code without giving it wording is a compile
 * error. Supabase's own message never reaches the screen — it is written for
 * developers, it changes without notice, and on a sign-up it can reveal
 * whether an address is already registered.
 */
import type { AuthErrorCode } from './auth-client'

export function describeAuthError(code: AuthErrorCode): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'E-mail or password is incorrect.'
    case 'EMAIL_NOT_CONFIRMED':
      return 'Confirm your e-mail address before signing in. Check your inbox for the link.'
    case 'EMAIL_ALREADY_REGISTERED':
      return 'This e-mail address is already registered. Sign in instead.'
    case 'WEAK_PASSWORD':
      return 'Choose a stronger password — at least 8 characters.'
    case 'SIGNUP_DISABLED':
      return 'Sign-ups are currently closed for this project.'
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a moment and try again.'
    case 'NOT_CONFIGURED':
      return 'Authentication is not configured on this deployment.'
    case 'UNAVAILABLE':
      return 'We could not reach the authentication service. Try again in a few moments.'
    default: {
      // Exhaustiveness guard: `code` is `never` once every case is handled.
      const exhaustive: never = code
      void exhaustive
      return 'Authentication failed. Try again.'
    }
  }
}
