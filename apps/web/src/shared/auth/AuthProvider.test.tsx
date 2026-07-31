/**
 * The two seams the provider is responsible for: the session reaching the HTTP
 * layer, and the query cache not outliving the organizer who filled it.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { installFakeAuthClient, makeSession } from '../../test/auth'
import { renderApp } from '../../test/render'
import { API_V1 } from '../api/config'
import { apiFetch } from '../api/http'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

/**
 * A query client with the production `gcTime`.
 *
 * The shared test client uses `gcTime: 0`, which would collect an
 * observer-less entry on its own and make "the cache was cleared" pass without
 * anything having cleared it.
 */
function createRetainingQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function Probe() {
  const { status, user, signOut } = useAuth()

  return (
    <>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? '—'}</span>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  )
}

function renderProbe(queryClient: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    )
  }

  return render(<Probe />, { wrapper: Wrapper })
}

describe('AuthProvider', () => {
  it('restores the persisted session on mount', async () => {
    installFakeAuthClient({ initialSession: makeSession({ email: 'ana@eventcheck.dev' }) })

    renderProbe(createRetainingQueryClient())

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })
    expect(screen.getByTestId('email')).toHaveTextContent('ana@eventcheck.dev')
  })

  it('feeds the session into the HTTP layer through the token provider', async () => {
    installFakeAuthClient({ initialSession: makeSession({ accessToken: 'session-jwt-abc' }) })

    let seenAuthorization: string | null = null
    server.use(
      http.get(`${API_V1}/me`, ({ request }) => {
        seenAuthorization = request.headers.get('Authorization')
        return HttpResponse.json({ id: 'x', email: 'a@b.dev', created_at: '2026-01-01T00:00:00Z' })
      }),
    )

    renderProbe(createRetainingQueryClient())
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })

    await apiFetch('/api/v1/me')

    // `http.ts` was not touched this phase: the real session arrives purely
    // through `setTokenProvider`.
    expect(seenAuthorization).toBe('Bearer session-jwt-abc')
  })

  it('follows a token refresh pushed through onAuthStateChange', async () => {
    const client = installFakeAuthClient({
      initialSession: makeSession({ accessToken: 'first-jwt' }),
    })

    let seenAuthorization: string | null = null
    server.use(
      http.get(`${API_V1}/me`, ({ request }) => {
        seenAuthorization = request.headers.get('Authorization')
        return HttpResponse.json({ id: 'x', email: 'a@b.dev', created_at: '2026-01-01T00:00:00Z' })
      }),
    )

    renderProbe(createRetainingQueryClient())
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })

    client.emit(makeSession({ accessToken: 'refreshed-jwt' }))

    await waitFor(async () => {
      await apiFetch('/api/v1/me')
      expect(seenAuthorization).toBe('Bearer refreshed-jwt')
    })
  })

  it('clears the query cache on sign-out', async () => {
    installFakeAuthClient({ initialSession: makeSession() })
    const queryClient = createRetainingQueryClient()

    // Stand in for whatever the previous organizer had already loaded.
    queryClient.setQueryData(['events', 'list', {}], { items: [{ title: 'Their event' }] })
    queryClient.setQueryData(['events', 'detail', 'abc'], { title: 'Their event' })

    renderProbe(queryClient)
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    })

    expect(queryClient.getQueryData(['events', 'list', {}])).toBeUndefined()
    expect(queryClient.getQueryData(['events', 'detail', 'abc'])).toBeUndefined()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('stops sending the old token once signed out', async () => {
    installFakeAuthClient({ initialSession: makeSession({ accessToken: 'session-jwt-abc' }) })

    let seenAuthorization: string | null = 'unset'
    server.use(
      http.get(`${API_V1}/me`, ({ request }) => {
        seenAuthorization = request.headers.get('Authorization')
        return HttpResponse.json({ id: 'x', email: 'a@b.dev', created_at: '2026-01-01T00:00:00Z' })
      }),
    )

    renderProbe(createRetainingQueryClient())
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    })

    await apiFetch('/api/v1/me')
    expect(seenAuthorization).toBeNull()
  })
})

describe('signing out from the app shell', () => {
  it('leaves no trace of the previous organizer on screen', async () => {
    installFakeAuthClient({ initialSession: makeSession({ email: 'ana@eventcheck.dev' }) })

    const user = userEvent.setup()
    renderApp({ route: '/events' })

    // The fixture data the mock API serves for the signed-in organizer.
    expect(await screen.findByText('React Summit Brasil 2026')).toBeInTheDocument()
    expect(screen.getByText('ana@eventcheck.dev')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText('React Summit Brasil 2026')).not.toBeInTheDocument()
    expect(screen.queryByText('ana@eventcheck.dev')).not.toBeInTheDocument()
  })
})
