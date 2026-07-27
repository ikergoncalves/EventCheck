/**
 * The window rule is shared with the backend, so it is pinned at the exact
 * boundaries: one minute either side of both edges, plus the edges themselves.
 */
import { describe, expect, it } from 'vitest'
import type { CheckInWindowEvent } from './check-in-window'
import {
  CHECK_IN_CLOSES_AFTER_END_HOURS,
  CHECK_IN_OPENS_BEFORE_START_HOURS,
  isWithinCheckInWindow,
  resolveEventStatus,
} from './check-in-window'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

const STARTS_AT = Date.parse('2026-08-14T19:00:00Z')
const ENDS_AT = Date.parse('2026-08-14T23:00:00Z')

const OPENS_AT = STARTS_AT - CHECK_IN_OPENS_BEFORE_START_HOURS * HOUR
const CLOSES_AT = ENDS_AT + CHECK_IN_CLOSES_AFTER_END_HOURS * HOUR

function event(status: CheckInWindowEvent['status']): CheckInWindowEvent {
  return {
    starts_at: new Date(STARTS_AT).toISOString(),
    ends_at: new Date(ENDS_AT).toISOString(),
    status,
  }
}

describe('check-in window constants', () => {
  it('matches the contract: 12 hours before the start, 2 hours after the end', () => {
    expect(CHECK_IN_OPENS_BEFORE_START_HOURS).toBe(12)
    expect(CHECK_IN_CLOSES_AFTER_END_HOURS).toBe(2)
  })
})

describe('isWithinCheckInWindow', () => {
  const published = event('published')

  it('is closed one minute before the window opens', () => {
    expect(isWithinCheckInWindow(published, OPENS_AT - MINUTE)).toBe(false)
  })

  it('is open exactly 12 hours before the start', () => {
    expect(isWithinCheckInWindow(published, OPENS_AT)).toBe(true)
  })

  it('is open one minute after it opened, and while the event runs', () => {
    expect(isWithinCheckInWindow(published, OPENS_AT + MINUTE)).toBe(true)
    expect(isWithinCheckInWindow(published, STARTS_AT + HOUR)).toBe(true)
  })

  it('is open one minute before it closes', () => {
    expect(isWithinCheckInWindow(published, CLOSES_AT - MINUTE)).toBe(true)
  })

  it('is open exactly at ends_at + 2h — the contract closes on "already past"', () => {
    expect(isWithinCheckInWindow(published, CLOSES_AT)).toBe(true)
  })

  it('is closed one minute after ends_at + 2h', () => {
    expect(isWithinCheckInWindow(published, CLOSES_AT + MINUTE)).toBe(false)
  })

  it('is closed for every status other than published, even mid-window', () => {
    const midWindow = STARTS_AT + HOUR

    expect(isWithinCheckInWindow(event('draft'), midWindow)).toBe(false)
    expect(isWithinCheckInWindow(event('finished'), midWindow)).toBe(false)
    expect(isWithinCheckInWindow(event('cancelled'), midWindow)).toBe(false)
  })
})

describe('resolveEventStatus', () => {
  it('keeps a published event published up to and including ends_at + 2h', () => {
    expect(resolveEventStatus(event('published'), CLOSES_AT - MINUTE)).toBe('published')
    expect(resolveEventStatus(event('published'), CLOSES_AT)).toBe('published')
  })

  it('promotes a published event to finished one minute after ends_at + 2h', () => {
    expect(resolveEventStatus(event('published'), CLOSES_AT + MINUTE)).toBe('finished')
  })

  it('leaves the other statuses untouched, however late it is', () => {
    const longAfter = CLOSES_AT + 365 * 24 * HOUR

    expect(resolveEventStatus(event('draft'), longAfter)).toBe('draft')
    expect(resolveEventStatus(event('finished'), longAfter)).toBe('finished')
    expect(resolveEventStatus(event('cancelled'), longAfter)).toBe('cancelled')
  })
})
