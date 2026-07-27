/**
 * Thin `fetch` wrapper that speaks the EventCheck contract.
 *
 * Responsibilities, and nothing beyond them:
 *  - resolve the base URL from the environment;
 *  - attach the bearer token from the injectable provider;
 *  - turn the contract's error envelope into a typed `ApiError`;
 *  - survive 204 / empty bodies.
 */
import { API_BASE_URL } from './config'
import { getAccessToken } from './token-provider'
import { type ApiErrorBody, type ApiErrorCode, isApiErrorCode } from './types'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/** A query value the contract can express: scalars, or repeated scalars. */
export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[]

export interface RequestOptions {
  method?: HttpMethod
  /** Serialized as JSON. Omit for bodyless verbs. */
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
  /** Set false for the contract's public routes (`security: []`). */
  auth?: boolean
  headers?: Record<string, string>
}

/**
 * A 4xx/5xx response that carried (or is treated as) the contract's error
 * envelope.
 *
 * `code` is narrowed to the contract's stable codes so consumers can `switch`
 * on it with exhaustiveness checked by the compiler. An unrecognized code from
 * the wire is normalized to a known one and preserved verbatim in `rawCode`,
 * so the union never silently widens to `string`.
 */
export class ApiError extends Error {
  readonly name = 'ApiError'
  readonly status: number
  readonly code: ApiErrorCode
  /** The code exactly as the server sent it, even when it is not in the union. */
  readonly rawCode: string
  readonly details?: Record<string, unknown>

  constructor(args: {
    status: number
    code: ApiErrorCode
    rawCode?: string
    message: string
    details?: Record<string, unknown>
  }) {
    super(args.message)
    this.status = args.status
    this.code = args.code
    this.rawCode = args.rawCode ?? args.code
    this.details = args.details
  }

  /** True for statuses that will never succeed on retry. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500
  }
}

/** Best-effort mapping when a response is not shaped like the envelope. */
function fallbackCodeForStatus(status: number): ApiErrorCode {
  // The contract has no `FORBIDDEN`: another organizer's resource answers 404.
  // A bare 403 can only come from infrastructure, so treat it as an auth problem.
  if (status === 401 || status === 403) return 'UNAUTHORIZED'
  if (status === 404) return 'EVENT_NOT_FOUND'
  if (status === 422) return 'VALIDATION_ERROR'
  if (status === 429) return 'RATE_LIMITED'
  return 'INTERNAL_ERROR'
}

function isErrorEnvelope(body: unknown): body is ApiErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false
  const { error } = body
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

function toApiError(status: number, body: unknown): ApiError {
  if (isErrorEnvelope(body)) {
    const { code, message, details } = body.error
    return new ApiError({
      status,
      code: isApiErrorCode(code) ? code : fallbackCodeForStatus(status),
      rawCode: code,
      message,
      details,
    })
  }

  const code = fallbackCodeForStatus(status)
  return new ApiError({ status, code, message: `Request failed with status ${status}.` })
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE_URL}${path}`)

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue
    // `style: form, explode: true` in the contract — repeat the key per item.
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item))
    } else {
      url.searchParams.append(key, String(value))
    }
  }

  return url.toString()
}

/** Reads the body without throwing on empty or non-JSON payloads. */
async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined
  const text = await response.text()
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/**
 * Performs a request against the API.
 *
 * Network failures propagate as-is (a `TypeError` from `fetch`), which is what
 * lets the query client tell "retry this" apart from "the server said no".
 *
 * @throws {ApiError} on any 4xx/5xx response.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, auth = true, headers = {} } = options

  const requestHeaders = new Headers({ Accept: 'application/json', ...headers })

  if (auth) {
    const token = await getAccessToken()
    if (token) requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  const payload = await readBody(response)

  if (!response.ok) throw toApiError(response.status, payload)

  // 204 and empty bodies resolve to undefined; callers type those as `void`.
  return payload as T
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
}
