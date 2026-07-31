import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API_V1 } from '../../../shared/api/config'
import { EVENT_IDS } from '../../../mocks/fixtures'
import { server } from '../../../mocks/server'
import { installFakeAuthClient, makeSession } from '../../../test/auth'
import { renderApp } from '../../../test/render'

function signedIn() {
  installFakeAuthClient({ initialSession: makeSession() })
  return userEvent.setup()
}

describe('EventDetailPage actions', () => {
  it('offers publish, edit and cancel on a draft', async () => {
    const user = signedIn()
    renderApp({ route: `/events/${EVENT_IDS.draft}` })

    expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel event' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Publish' }))

    expect(await screen.findByText('Published')).toBeInTheDocument()
    // The transition is one-way, so the action retires with it.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    })
  })

  it('hides every action on a terminal event', async () => {
    signedIn()
    renderApp({ route: `/events/${EVENT_IDS.finished}` })

    expect(await screen.findByText('Finished')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel event' })).not.toBeInTheDocument()
  })

  it('spells out the consequence before cancelling, and revokes on confirm', async () => {
    const user = signedIn()
    renderApp({ route: `/events/${EVENT_IDS.published}` })

    await screen.findByText('Published')
    await user.click(screen.getByRole('button', { name: 'Cancel event' }))

    const dialog = await screen.findByRole('alertdialog')
    // The organizer has to be told what "cancel" actually does.
    expect(dialog).toHaveTextContent('every valid ticket for it is revoked')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel the event' }))

    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('backs out without touching the event', async () => {
    const user = signedIn()
    renderApp({ route: `/events/${EVENT_IDS.published}` })

    await screen.findByText('Published')
    await user.click(screen.getByRole('button', { name: 'Cancel event' }))

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Keep the event' }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  /**
   * The UI hides impossible actions, and still has to survive being told no.
   * The status on screen was read in the past; the contract's lazy transition
   * moves a `published` event to `finished` with nobody clicking anything, so
   * a button that was legitimate when rendered can be refused when pressed.
   */
  it('reports a 409 the rendered status could not have predicted', async () => {
    const user = signedIn()

    server.use(
      http.delete(`${API_V1}/events/:event_id`, () =>
        HttpResponse.json(
          {
            error: { code: 'EVENT_IMMUTABLE', message: 'A finished event cannot be cancelled.' },
          },
          { status: 409 },
        ),
      ),
    )

    renderApp({ route: `/events/${EVENT_IDS.published}` })

    await screen.findByText('Published')
    await user.click(screen.getByRole('button', { name: 'Cancel event' }))

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel the event' }))

    // Reported where the decision was made, in the app's own words.
    expect(
      await within(dialog).findByText('This event can no longer be modified.'),
    ).toBeInTheDocument()
  })

  it('refuses to edit an event that is no longer editable', async () => {
    signedIn()
    renderApp({ route: `/events/${EVENT_IDS.cancelled}/edit` })

    expect(await screen.findByText('This event can no longer be edited')).toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  })
})
