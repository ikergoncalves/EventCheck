/**
 * The guard's contract with the rest of the app.
 *
 * The first test is the one that matters most: restoring a persisted session
 * takes a tick, and a guard that treats that tick as "signed out" makes every
 * refresh of a protected page flash the login screen before bouncing back.
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { installFakeAuthClient, makeSession } from '../test/auth'
import { renderApp } from '../test/render'

describe('RequireAuth', () => {
  it('renders a loading state while the session is still being restored', async () => {
    installFakeAuthClient({ pendingRestore: true })

    renderApp({ route: '/events' })

    expect(await screen.findByText('Restoring your session…')).toBeInTheDocument()

    // The point of the test: no redirect happened while the answer was unknown.
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('sends an anonymous visitor to the login screen', async () => {
    installFakeAuthClient({ initialSession: null })

    renderApp({ route: '/events' })

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('renders the route for an authenticated organizer', async () => {
    installFakeAuthClient({ initialSession: makeSession() })

    renderApp({ route: '/events' })

    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('returns to the intended route after signing in', async () => {
    const session = makeSession()
    installFakeAuthClient({ initialSession: null, signInResult: { ok: true, session } })

    const user = userEvent.setup()
    // A deep link the guard has to remember rather than discard.
    renderApp({ route: '/events/new' })

    await user.type(await screen.findByLabelText(/e-mail/i), 'organizer@eventcheck.dev')
    await user.type(screen.getByLabelText(/password/i), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    // Not the events list, which is where a guard without memory would land.
    expect(await screen.findByRole('heading', { name: 'New event' })).toBeInTheDocument()
  })

  it('unsubscribes from auth changes when it unmounts', async () => {
    const client = installFakeAuthClient({ initialSession: makeSession() })

    const { unmount } = renderApp({ route: '/events' })
    await screen.findByRole('heading', { name: 'Events' })
    expect(client.listenerCount()).toBe(1)

    unmount()

    await waitFor(() => {
      expect(client.listenerCount()).toBe(0)
    })
  })
})

describe('RedirectIfAuthenticated', () => {
  it('keeps a signed-in organizer away from the login screen', async () => {
    installFakeAuthClient({ initialSession: makeSession() })

    renderApp({ route: '/login' })

    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument()
  })

  it('lets an anonymous visitor reach the sign-up screen', async () => {
    installFakeAuthClient({ initialSession: null })

    renderApp({ route: '/signup' })

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })
})
