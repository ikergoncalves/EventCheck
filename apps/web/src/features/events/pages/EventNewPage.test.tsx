import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API_V1 } from '../../../shared/api/config'
import type { EventCreate } from '../../../shared/api/types'
import { server } from '../../../mocks/server'
import { installFakeAuthClient, makeSession } from '../../../test/auth'
import { renderApp } from '../../../test/render'

/**
 * A zone that is neither UTC nor anywhere this suite is likely to run, and
 * which has never observed daylight saving. Picking it deliberately is the
 * point: if the form ever converted through the browser's zone instead of the
 * one selected, the instant below would come out hours off.
 */
const EVENT_TIME_ZONE = 'Asia/Tokyo'

/**
 * `datetime-local` controls do not respond to typing the way a text box does,
 * so the value is set directly. React Hook Form registers an `onChange`, which
 * is what this dispatches.
 */
function setDateTime(input: HTMLElement, value: string): void {
  fireEvent.change(input, { target: { value } })
}

async function fillValidEvent(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Title'), 'Encontro de Outono')
  await user.selectOptions(screen.getByLabelText('Time zone'), EVENT_TIME_ZONE)

  setDateTime(screen.getByLabelText('Starts at'), '2026-11-14T16:30')
  setDateTime(screen.getByLabelText('Ends at'), '2026-11-14T20:00')

  const capacity = screen.getByLabelText('Capacity')
  await user.clear(capacity)
  await user.type(capacity, '250')
}

describe('EventNewPage', () => {
  it('creates the event and lands on its detail page', async () => {
    installFakeAuthClient({ initialSession: makeSession() })

    const user = userEvent.setup()
    renderApp({ route: '/events/new' })

    await fillValidEvent(user)
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    // The detail page for the freshly created draft.
    expect(await screen.findByRole('heading', { name: 'Encontro de Outono' })).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
  })

  it('sends the instants converted through the event’s zone, not the browser’s', async () => {
    installFakeAuthClient({ initialSession: makeSession() })

    let body: EventCreate | null = null
    server.use(
      http.post(`${API_V1}/events`, async ({ request }) => {
        body = (await request.json()) as EventCreate
        return HttpResponse.json(
          {
            id: 'created-id',
            organizer_id: 'organizer',
            title: body.title,
            description: body.description ?? null,
            starts_at: body.starts_at,
            ends_at: body.ends_at,
            timezone: body.timezone,
            venue_name: null,
            address: null,
            capacity: body.capacity,
            status: 'draft',
            tickets_issued: 0,
            checked_in_count: 0,
            created_at: '2026-07-30T00:00:00Z',
            updated_at: '2026-07-30T00:00:00Z',
          },
          { status: 201 },
        )
      }),
    )

    const user = userEvent.setup()
    renderApp({ route: '/events/new' })

    await fillValidEvent(user)
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    await waitFor(() => {
      expect(body).not.toBeNull()
    })

    // 16:30 in Tokyo (UTC+9) is 07:30 UTC, whatever the machine's own zone is.
    expect(body!.starts_at).toBe('2026-11-14T07:30:00.000Z')
    expect(body!.ends_at).toBe('2026-11-14T11:00:00.000Z')
    expect(body!.timezone).toBe(EVENT_TIME_ZONE)
  })

  it('puts a contract 422 on the field it names', async () => {
    installFakeAuthClient({ initialSession: makeSession() })

    // `starts_at must be in the future` is the contract's own example, and a
    // rule only the server can apply — which is exactly why the 422 path has
    // to work rather than being a formality the client validation hides.
    server.use(
      http.post(`${API_V1}/events`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request body is invalid.',
              details: { fields: [{ field: 'starts_at', message: 'must be in the future' }] },
            },
          },
          { status: 422 },
        ),
      ),
    )

    const user = userEvent.setup()
    renderApp({ route: '/events/new' })

    await fillValidEvent(user)
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    const message = await screen.findByText('must be in the future')

    // Not a banner at the top: the message is wired to the control it is about.
    const startsAt = screen.getByLabelText('Starts at')
    expect(startsAt).toHaveAttribute('aria-invalid', 'true')
    expect(startsAt).toHaveAttribute('aria-describedby', message.id)

    // And the organizer is still on the form, with their input intact.
    expect(screen.getByLabelText('Title')).toHaveValue('Encontro de Outono')
  })

  it('refuses an end before the start without asking the server', async () => {
    installFakeAuthClient({ initialSession: makeSession() })

    let posted = 0
    server.use(
      http.post(`${API_V1}/events`, () => {
        posted += 1
        return new HttpResponse(null, { status: 500 })
      }),
    )

    const user = userEvent.setup()
    renderApp({ route: '/events/new' })

    await fillValidEvent(user)
    setDateTime(screen.getByLabelText('Ends at'), '2026-11-14T09:00')
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    expect(await screen.findByText('The end must come after the start.')).toBeInTheDocument()
    expect(posted).toBe(0)
  })
})
