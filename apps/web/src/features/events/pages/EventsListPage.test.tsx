import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { API_V1 } from '../../../shared/api/config'
import { server } from '../../../mocks/server'
import { renderWithProviders } from '../../../test/render'
import { EventsListPage } from './EventsListPage'

describe('EventsListPage', () => {
  it('renders the events served by the mock API', async () => {
    renderWithProviders(<EventsListPage />)

    // Loading state comes first, before MSW answers.
    expect(screen.getByRole('status')).toHaveTextContent('Loading events…')

    expect(await screen.findByText('React Summit Brasil 2026')).toBeInTheDocument()
    expect(screen.getByText('Workshop: QR Code na portaria')).toBeInTheDocument()
    expect(screen.getByText('Meetup Frontend SP — Edição de Junho')).toBeInTheDocument()

    // Fixture: 40 tickets, 3 revoked and 24 checked in, plus the scenario
    // tickets — 24 + 1 already-checked-in over 37 + 2 non-revoked.
    expect(screen.getByText('25 / 39')).toBeInTheDocument()

    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Finished')).toBeInTheDocument()
  })

  it('shows the error state when the API returns a contract error', async () => {
    server.use(
      http.get(`${API_V1}/events`, () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid credentials.' } },
          { status: 401 },
        ),
      ),
    )

    renderWithProviders(<EventsListPage />)

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('Could not load your events')
    expect(alert).toHaveTextContent('Your session has expired. Sign in again to continue.')
  })

  it('shows the empty state when the organizer has no events', async () => {
    server.use(
      http.get(`${API_V1}/events`, () =>
        HttpResponse.json({ page: 1, page_size: 20, total: 0, total_pages: 1, items: [] }),
      ),
    )

    renderWithProviders(<EventsListPage />)

    await waitFor(() => {
      expect(screen.getByText('No events yet')).toBeInTheDocument()
    })
  })
})
