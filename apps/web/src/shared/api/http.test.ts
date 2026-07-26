import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { expectApiError } from '../../test/api'
import { API_BASE_URL, API_V1 } from './config'
import { ApiError, apiFetch } from './http'
import { STUB_ACCESS_TOKEN } from './token-provider'

describe('apiFetch', () => {
  it('turns a contract error envelope into a typed ApiError', async () => {
    server.use(
      http.post(`${API_V1}/events/:event_id/check-ins`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'TICKET_ALREADY_CHECKED_IN',
              message: 'This ticket was already used.',
              details: {
                ticket_id: '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
                attendee_name: 'Ana Souza',
                checked_in_at: '2026-08-14T19:32:11Z',
                device_label: 'Portaria A',
              },
            },
          },
          { status: 409 },
        ),
      ),
    )

    const error = await expectApiError(
      apiFetch('/api/v1/events/evt/check-ins', {
        method: 'POST',
        body: { qr_token: 'x'.repeat(32) },
      }),
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('TICKET_ALREADY_CHECKED_IN')
    expect(error.status).toBe(409)
    expect(error.message).toBe('This ticket was already used.')
    expect(error.details).toMatchObject({ attendee_name: 'Ana Souza', device_label: 'Portaria A' })
    expect(error.isClientError).toBe(true)
  })

  it('maps an unrecognized code to a known one while preserving the raw value', async () => {
    server.use(
      http.get(`${API_V1}/me`, () =>
        HttpResponse.json(
          { error: { code: 'SOMETHING_NEW', message: 'Unknown to this client.' } },
          { status: 500 },
        ),
      ),
    )

    const error = await expectApiError(apiFetch('/api/v1/me'))

    expect(error.code).toBe('INTERNAL_ERROR')
    expect(error.rawCode).toBe('SOMETHING_NEW')
    expect(error.isClientError).toBe(false)
  })

  it('falls back to a status-derived code when the body is not an envelope', async () => {
    server.use(
      http.get(`${API_V1}/me`, () => new HttpResponse('gateway exploded', { status: 502 })),
    )

    const error = await expectApiError(apiFetch('/api/v1/me'))

    expect(error.code).toBe('INTERNAL_ERROR')
    expect(error.status).toBe(502)
  })

  it('resolves 204 and empty bodies without throwing', async () => {
    server.use(
      http.delete(`${API_V1}/events/:event_id`, () => new HttpResponse(null, { status: 204 })),
    )

    await expect(apiFetch('/api/v1/events/evt', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('sends the bearer token from the injectable provider', async () => {
    let seenAuthorization: string | null = null
    server.use(
      http.get(`${API_V1}/me`, ({ request }) => {
        seenAuthorization = request.headers.get('Authorization')
        return HttpResponse.json({ id: 'x', email: 'a@b.dev', created_at: '2026-01-01T00:00:00Z' })
      }),
    )

    await apiFetch('/api/v1/me')

    expect(seenAuthorization).toBe(`Bearer ${STUB_ACCESS_TOKEN}`)
  })

  it('omits the Authorization header on public routes', async () => {
    let seenAuthorization: string | null = 'unset'
    server.use(
      http.get(`${API_BASE_URL}/health`, ({ request }) => {
        seenAuthorization = request.headers.get('Authorization')
        return HttpResponse.json({ status: 'ok', version: '1.0.0', uptime_seconds: 1 })
      }),
    )

    await apiFetch('/health', { auth: false })

    expect(seenAuthorization).toBeNull()
  })

  it('repeats query parameters for array values, as the contract specifies', async () => {
    let seenUrl = ''
    server.use(
      http.get(`${API_V1}/events`, ({ request }) => {
        seenUrl = request.url
        return HttpResponse.json({ page: 1, page_size: 20, total: 0, total_pages: 1, items: [] })
      }),
    )

    await apiFetch('/api/v1/events', { query: { status: ['draft', 'published'], page: 2 } })

    const url = new URL(seenUrl)
    expect(url.searchParams.getAll('status')).toEqual(['draft', 'published'])
    expect(url.searchParams.get('page')).toBe('2')
  })
})
