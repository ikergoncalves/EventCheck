import { expect } from 'vitest'
import { ApiError } from '../shared/api/http'

/**
 * Awaits a request that is expected to fail and hands back the typed error.
 *
 * Keeps the `unknown` from `catch` out of every individual assertion.
 */
export async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  const outcome: unknown = await promise.then(
    () => null,
    (error: unknown) => error,
  )

  expect(outcome).toBeInstanceOf(ApiError)
  return outcome as ApiError
}
