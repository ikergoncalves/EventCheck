import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { installFakeAuthClient, makeSession } from '../../../test/auth'
import { renderApp } from '../../../test/render'

describe('LoginPage', () => {
  it('shows the failure and stays put when the credentials are rejected', async () => {
    const client = installFakeAuthClient({
      initialSession: null,
      signInResult: { ok: false, code: 'INVALID_CREDENTIALS' },
    })

    const user = userEvent.setup()
    renderApp({ route: '/login' })

    await user.type(await screen.findByLabelText(/e-mail/i), 'organizer@eventcheck.dev')
    await user.type(screen.getByLabelText(/password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail or password is incorrect.')

    // Still on the login screen, and nothing behind the guard was rendered.
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Events' })).not.toBeInTheDocument()
    expect(client.signInCalls).toEqual([
      { email: 'organizer@eventcheck.dev', password: 'wrong-password' },
    ])
  })

  it('never leaks the raw provider message', async () => {
    installFakeAuthClient({
      initialSession: null,
      signInResult: { ok: false, code: 'UNAVAILABLE' },
    })

    const user = userEvent.setup()
    renderApp({ route: '/login' })

    await user.type(await screen.findByLabelText(/e-mail/i), 'organizer@eventcheck.dev')
    await user.type(screen.getByLabelText(/password/i), 'whatever')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('We could not reach the authentication service.')
    expect(alert.textContent).not.toMatch(/supabase|AuthApiError|fetch/i)
  })

  it('validates the form before calling the auth client at all', async () => {
    const client = installFakeAuthClient({ initialSession: null })

    const user = userEvent.setup()
    renderApp({ route: '/login' })

    await user.type(await screen.findByLabelText(/e-mail/i), 'not-an-email')
    await user.type(screen.getByLabelText(/password/i), 'whatever')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid e-mail address.')).toBeInTheDocument()
    expect(client.signInCalls).toHaveLength(0)
  })

  it('signs in and lands on the events list', async () => {
    installFakeAuthClient({
      initialSession: null,
      signInResult: { ok: true, session: makeSession() },
    })

    const user = userEvent.setup()
    renderApp({ route: '/login' })

    await user.type(await screen.findByLabelText(/e-mail/i), 'organizer@eventcheck.dev')
    await user.type(screen.getByLabelText(/password/i), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument()
  })
})

describe('SignupPage', () => {
  it('asks the organizer to confirm their e-mail when no session comes back', async () => {
    // A Supabase project with e-mail confirmation enabled answers exactly this
    // way: the sign-up worked, but there is no way in until the link is opened.
    installFakeAuthClient({
      initialSession: null,
      signUpResult: { ok: true, session: null },
    })

    const user = userEvent.setup()
    renderApp({ route: '/signup' })

    await user.type(await screen.findByLabelText(/e-mail/i), 'new.organizer@eventcheck.dev')
    await user.type(screen.getByLabelText('Password'), 'a-long-enough-password')
    await user.type(screen.getByLabelText('Repeat password'), 'a-long-enough-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Confirm your e-mail' })).toBeInTheDocument()
    expect(screen.getByText('new.organizer@eventcheck.dev')).toBeInTheDocument()

    // Explicitly not dropped into the app, and explicitly not left on a form
    // that silently cleared itself.
    expect(screen.queryByRole('heading', { name: 'Events' })).not.toBeInTheDocument()
  })

  it('goes straight into the app when the project returns a session', async () => {
    installFakeAuthClient({
      initialSession: null,
      signUpResult: { ok: true, session: makeSession() },
    })

    const user = userEvent.setup()
    renderApp({ route: '/signup' })

    await user.type(await screen.findByLabelText(/e-mail/i), 'new.organizer@eventcheck.dev')
    await user.type(screen.getByLabelText('Password'), 'a-long-enough-password')
    await user.type(screen.getByLabelText('Repeat password'), 'a-long-enough-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument()
  })
})
