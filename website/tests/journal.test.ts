import { describe, expect, test } from 'bun:test'

import {
  formatCardDate,
  formatPublicationDate,
  getPublicationDate,
  journalPageHref,
} from '../src/lib/journal'

describe('journal presentation', () => {
  test('uses the publication date in compact card format', () => {
    expect(getPublicationDate({ startsAt: '2026-07-28T17:00:00.000Z', createdAt: '2026-07-01T00:00:00.000Z' })).toBe('2026-07-28T17:00:00.000Z')
    expect(getPublicationDate({ startsAt: null, createdAt: '2026-07-01T00:00:00.000Z' })).toBe('2026-07-01T00:00:00.000Z')
    expect(formatCardDate('2026-07-28T17:00:00.000Z')).toBe('29.07.2026')
    expect(formatPublicationDate('2026-07-28T17:00:00.000Z')).toBe('29 июля 2026 г.')
  })

  test('keeps the first page at the canonical journal URL', () => {
    expect(journalPageHref(1)).toBe('/journal')
    expect(journalPageHref(3)).toBe('/journal/page/3')
  })
})
