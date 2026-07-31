/**
 * Date helpers.
 *
 * The API sends every timestamp as ISO 8601 in UTC; each event carries an IANA
 * `timezone` that exists purely for display. So every user-facing timestamp is
 * formatted in the event's zone, never in the browser's.
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

const DATE_TIME_FORMAT = "MMM d, yyyy 'at' HH:mm"
const TIME_FORMAT = 'HH:mm'
const DATE_FORMAT = 'MMM d, yyyy'

/** e.g. `Aug 14, 2026 at 16:30 GMT-3` */
export function formatEventDateTime(isoTimestamp: string, timeZone: string): string {
  return formatInTimeZone(isoTimestamp, timeZone, `${DATE_TIME_FORMAT} zzz`)
}

/** e.g. `Aug 14, 2026` */
export function formatEventDate(isoTimestamp: string, timeZone: string): string {
  return formatInTimeZone(isoTimestamp, timeZone, DATE_FORMAT)
}

/**
 * Collapses the repeated date when an event starts and ends on the same day in
 * its own timezone: `Aug 14, 2026 at 16:30 – 20:00 GMT-3`.
 */
export function formatEventDateRange(startIso: string, endIso: string, timeZone: string): string {
  const sameDay =
    formatInTimeZone(startIso, timeZone, 'yyyy-MM-dd') ===
    formatInTimeZone(endIso, timeZone, 'yyyy-MM-dd')

  const start = formatInTimeZone(startIso, timeZone, DATE_TIME_FORMAT)
  const end = formatInTimeZone(endIso, timeZone, sameDay ? TIME_FORMAT : DATE_TIME_FORMAT)
  const zone = formatInTimeZone(endIso, timeZone, 'zzz')

  return `${start} – ${end} ${zone}`
}

/* -------------------------------------------------------------------------- */
/* Form input <-> contract instant                                             */
/* -------------------------------------------------------------------------- */

/** The shape `<input type="datetime-local">` reads and writes. */
const LOCAL_INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm"

/**
 * Turns a wall-clock value typed by the organizer into the contract's instant.
 *
 * The conversion is anchored on the event's own `timeZone`, never on the
 * browser's. Someone in Lisbon scheduling a São Paulo event types the time the
 * doors open in São Paulo; reading that string as local time would silently
 * shift the event by the offset between the two zones — and, worse, would do
 * it correctly on the organizer's machine and wrongly on everyone else's.
 *
 * @param localValue `yyyy-MM-ddTHH:mm`, straight from a datetime-local input.
 * @returns ISO 8601 in UTC with a `Z` suffix, as the contract requires.
 */
export function zonedInputToUtcIso(localValue: string, timeZone: string): string {
  return fromZonedTime(localValue, timeZone).toISOString()
}

/** The inverse, for populating the edit form from a stored event. */
export function utcIsoToZonedInput(isoTimestamp: string, timeZone: string): string {
  return formatInTimeZone(isoTimestamp, timeZone, LOCAL_INPUT_FORMAT)
}

/** Whether the runtime recognizes an IANA identifier. */
export function isSupportedTimeZone(timeZone: string): boolean {
  if (timeZone.length === 0) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/** The browser's own zone, used as the default when creating an event. */
export function browserTimeZone(): string {
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone
  return resolved.length > 0 ? resolved : 'UTC'
}

/**
 * Zones offered in the event form.
 *
 * `Intl.supportedValuesOf` is the authoritative list, but it is not universally
 * available; the fallback keeps the form usable rather than empty. Either way
 * the browser's own zone is guaranteed to be in the list, since it is the
 * default selection.
 */
const FALLBACK_TIME_ZONES = [
  'America/Sao_Paulo',
  'America/Fortaleza',
  'America/Manaus',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Berlin',
  'UTC',
]

export function listTimeZones(): string[] {
  const supported =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []

  const zones = new Set(supported.length > 0 ? supported : FALLBACK_TIME_ZONES)
  zones.add(browserTimeZone())

  return [...zones].sort((a, b) => a.localeCompare(b))
}
