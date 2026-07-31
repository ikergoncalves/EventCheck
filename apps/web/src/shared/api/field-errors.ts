/**
 * Reads the per-field detail out of a contract `422 VALIDATION_ERROR`.
 *
 * This is the one place in the app that parses a payload at runtime instead of
 * deriving a type from `schema.d.ts`, and the contract is the reason: `details`
 * is declared `additionalProperties: true`, so the generator has nothing to
 * emit beyond `Record<string, unknown>`. There is no type to derive — only a
 * documented convention to validate. The example in the contract is
 *
 *   details: { fields: [{ field: 'starts_at', message: 'must be in the future' }] }
 *
 * and this parser accepts exactly that, ignoring anything malformed rather than
 * throwing: a server that answers oddly should still produce a usable form
 * error, not a blank screen.
 *
 * @see docs/api-contract/openapi.yaml — components.responses.ValidationError
 */
import { ApiError } from './http'

export interface ApiFieldError {
  /** The API's own field name, in snake_case, e.g. `ends_at`. */
  field: string
  message: string
}

function toFieldError(entry: unknown): ApiFieldError | null {
  if (typeof entry !== 'object' || entry === null) return null

  const { field, message } = entry as { field?: unknown; message?: unknown }
  if (typeof field !== 'string' || field.length === 0) return null
  if (typeof message !== 'string' || message.length === 0) return null

  return { field, message }
}

/** The field errors carried by a 422, or an empty array for anything else. */
export function readFieldErrors(error: unknown): ApiFieldError[] {
  if (!(error instanceof ApiError)) return []
  if (error.code !== 'VALIDATION_ERROR') return []

  const fields = error.details?.fields
  if (!Array.isArray(fields)) return []

  return fields.map(toFieldError).filter((entry): entry is ApiFieldError => entry !== null)
}
