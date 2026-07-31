import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './auth-context'

/**
 * The authentication state and actions.
 *
 * @throws when called outside `AuthProvider`, which is a wiring bug rather than
 * a state a component could sensibly render.
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) throw new Error('useAuth must be used inside an AuthProvider.')
  return value
}
