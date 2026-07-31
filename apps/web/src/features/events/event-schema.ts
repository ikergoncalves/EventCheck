/**
 * Client-side validation for the event form.
 *
 * Every bound here is copied from the contract, deliberately and with the same
 * boundaries, so the form refuses what the API would refuse — one round trip
 * saved, and the organizer finds out while their cursor is still in the field.
 * It does not replace the server's validation: the 422 path is handled too,
 * because the contract is the authority and this file is only its echo.
 *
 * @see docs/api-contract/openapi.yaml — components.schemas.EventCreate
 */
import { z } from 'zod'
import { isSupportedTimeZone, zonedInputToUtcIso } from '../../shared/lib/datetime'
import type { EventCreate } from '../../shared/api/types'

/* Bounds, straight from the contract's schema. */
export const TITLE_MIN_LENGTH = 3
export const TITLE_MAX_LENGTH = 120
export const DESCRIPTION_MAX_LENGTH = 5000
export const VENUE_NAME_MAX_LENGTH = 160
export const ADDRESS_MAX_LENGTH = 300
export const CAPACITY_MIN = 1
export const CAPACITY_MAX = 100000

export const eventFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(TITLE_MIN_LENGTH, `Use at least ${TITLE_MIN_LENGTH} characters.`)
      .max(TITLE_MAX_LENGTH, `Use at most ${TITLE_MAX_LENGTH} characters.`),

    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX_LENGTH, `Use at most ${DESCRIPTION_MAX_LENGTH} characters.`),

    /* Wall-clock values, read in `timezone` — not in the browser's zone. */
    startsAtLocal: z.string().min(1, 'Choose when the event starts.'),
    endsAtLocal: z.string().min(1, 'Choose when the event ends.'),

    timezone: z.string().refine(isSupportedTimeZone, 'Choose a valid time zone.'),

    venueName: z
      .string()
      .trim()
      .max(VENUE_NAME_MAX_LENGTH, `Use at most ${VENUE_NAME_MAX_LENGTH} characters.`),

    address: z
      .string()
      .trim()
      .max(ADDRESS_MAX_LENGTH, `Use at most ${ADDRESS_MAX_LENGTH} characters.`),

    /*
     * A number, not a coerced string: the control is registered with
     * `valueAsNumber`, so an empty field arrives as `NaN` and trips the type
     * error below. Coercion would turn it into 0 and report the wrong problem.
     */
    capacity: z
      .number({ error: 'Enter the number of seats.' })
      .int('Enter a whole number.')
      .min(CAPACITY_MIN, `Capacity must be at least ${CAPACITY_MIN}.`)
      .max(CAPACITY_MAX, `Capacity must be at most ${CAPACITY_MAX.toLocaleString('en-US')}.`),
  })
  .superRefine((values, ctx) => {
    // The contract's rule is about instants, not about the strings typed in.
    // Comparing them in the event's own zone is what makes the check survive a
    // daylight-saving change falling between the two dates.
    if (!isSupportedTimeZone(values.timezone)) return

    const startsAt = Date.parse(zonedInputToUtcIso(values.startsAtLocal, values.timezone))
    const endsAt = Date.parse(zonedInputToUtcIso(values.endsAtLocal, values.timezone))
    if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return

    if (endsAt <= startsAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAtLocal'],
        message: 'The end must come after the start.',
      })
    }
  })

export type EventFormValues = z.infer<typeof eventFormSchema>

/**
 * Projects the form onto the contract's `EventCreate`.
 *
 * `PATCH` reuses this: every property of `EventUpdate` is optional, so a full
 * body is a valid partial update and the two verbs can share one form.
 */
export function toEventPayload(values: EventFormValues): EventCreate {
  return {
    title: values.title,
    description: values.description.length > 0 ? values.description : null,
    starts_at: zonedInputToUtcIso(values.startsAtLocal, values.timezone),
    ends_at: zonedInputToUtcIso(values.endsAtLocal, values.timezone),
    timezone: values.timezone,
    venue_name: values.venueName.length > 0 ? values.venueName : null,
    address: values.address.length > 0 ? values.address : null,
    capacity: values.capacity,
  }
}

/**
 * Maps the API's field names onto the form's.
 *
 * Mostly one to one, except for the timestamps: the contract carries a UTC
 * instant while the form holds a wall-clock string, so the names cannot match.
 * A field missing from this map falls back to the form-level alert.
 */
export const FORM_FIELD_BY_API_FIELD: Record<string, keyof EventFormValues> = {
  title: 'title',
  description: 'description',
  starts_at: 'startsAtLocal',
  ends_at: 'endsAtLocal',
  timezone: 'timezone',
  venue_name: 'venueName',
  address: 'address',
  capacity: 'capacity',
}
