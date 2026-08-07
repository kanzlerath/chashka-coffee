import { describe, expect, test } from 'bun:test'

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from '../src/lib/analytics-consent'

const createStorage = (initialValue: string | null = null) => {
  let value = initialValue

  return {
    getItem: (key: string) => key === ANALYTICS_CONSENT_STORAGE_KEY ? value : null,
    setItem: (key: string, nextValue: string) => {
      if (key === ANALYTICS_CONSENT_STORAGE_KEY) value = nextValue
    },
  }
}

describe('analytics consent', () => {
  test('treats missing, malformed and obsolete choices as undecided', () => {
    expect(readAnalyticsConsent(createStorage())).toBeNull()
    expect(readAnalyticsConsent(createStorage('not-json'))).toBeNull()
    expect(readAnalyticsConsent(createStorage('{"version":0,"status":"granted"}'))).toBeNull()
    expect(readAnalyticsConsent(createStorage('{"version":1,"status":"unknown"}'))).toBeNull()
  })

  test('restores an explicit granted or denied choice', () => {
    expect(readAnalyticsConsent(createStorage('{"version":1,"status":"granted"}'))).toBe('granted')
    expect(readAnalyticsConsent(createStorage('{"version":1,"status":"denied"}'))).toBe('denied')
  })

  test('stores the current consent format without relying on cookies', () => {
    const storage = createStorage()

    writeAnalyticsConsent(storage, 'granted')

    expect(readAnalyticsConsent(storage)).toBe('granted')
  })
})
