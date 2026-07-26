/**
 * Date helpers.
 *
 * The API sends every timestamp as ISO 8601 in UTC; each event carries an IANA
 * `timezone` that exists purely for display. So every user-facing timestamp is
 * formatted in the event's zone, never in the browser's.
 */
import { formatInTimeZone } from 'date-fns-tz'

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
