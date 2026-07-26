import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'

interface Options extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL. Use together with `path` to exercise route params. */
  route?: string
  /** Route pattern the element is mounted under, e.g. `/events/:eventId`. */
  path?: string
}

/**
 * Renders a component inside the providers it needs.
 *
 * Retries are off so an error-state test fails fast instead of waiting out the
 * production retry policy.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path, ...options }: Options = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          {path ? (
            <Routes>
              <Route path={path} element={children} />
            </Routes>
          ) : (
            children
          )}
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}
