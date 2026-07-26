import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './http'

const MAX_RETRIES = 3

/**
 * A 4xx will fail the same way however many times we ask, so only network
 * failures and 5xx are worth retrying.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.isClientError) return false
  return failureCount < MAX_RETRIES
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
