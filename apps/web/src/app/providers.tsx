import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { BrowserRouter } from 'react-router'
import { createQueryClient } from '../shared/api/query-client'
import { ErrorBoundary } from './ErrorBoundary'

export function AppProviders({ children }: { children: ReactNode }) {
  // One client per mount, created lazily so tests get an isolated cache.
  const [queryClient] = useState(createQueryClient)

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
