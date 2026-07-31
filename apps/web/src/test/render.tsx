import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AppRoutes } from '../app/router'
import { AuthProvider } from '../shared/auth/AuthProvider'

/**
 * Retries are off so an error-state test fails fast instead of waiting out the
 * production retry policy.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL. Use together with `path` to exercise route params. */
  route?: string
  /** Route pattern the element is mounted under, e.g. `/events/:eventId`. */
  path?: string
  /**
   * Wraps the tree in `AuthProvider`. Install a fake auth client first — see
   * `test/auth.ts` — or the provider will reach for a real Supabase project.
   */
  withAuth?: boolean
}

/** Renders a component inside the providers it needs. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path, withAuth = false, ...options }: Options = {},
) {
  const queryClient = createTestQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    const routed = (
      <MemoryRouter initialEntries={[route]}>
        {path ? (
          <Routes>
            <Route path={path} element={children} />
          </Routes>
        ) : (
          children
        )}
      </MemoryRouter>
    )

    return (
      <QueryClientProvider client={queryClient}>
        {withAuth ? <AuthProvider>{routed}</AuthProvider> : routed}
      </QueryClientProvider>
    )
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}

/**
 * Renders the whole routing tree, guards included.
 *
 * Mirrors `app/providers.tsx` with `MemoryRouter` swapped in for
 * `BrowserRouter`, which is what lets a test start on an arbitrary URL and
 * then assert where the guards sent it.
 */
export function renderApp({ route = '/' }: { route?: string } = {}) {
  const queryClient = createTestQueryClient()

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )

  return { queryClient, ...result }
}
