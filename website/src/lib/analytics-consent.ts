export const ANALYTICS_CONSENT_STORAGE_KEY = 'chashka_analytics_consent'
export const ANALYTICS_CONSENT_VERSION = 1

export type AnalyticsConsent = 'granted' | 'denied'

type ConsentStorage = Pick<Storage, 'getItem' | 'setItem'>

export function readAnalyticsConsent(storage: ConsentStorage): AnalyticsConsent | null {
  try {
    const stored = JSON.parse(storage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) ?? 'null')

    if (
      stored?.version === ANALYTICS_CONSENT_VERSION
      && (stored.status === 'granted' || stored.status === 'denied')
    ) {
      return stored.status
    }
  } catch {
    // A damaged browser value should behave like no choice was made.
  }

  return null
}

export function writeAnalyticsConsent(storage: ConsentStorage, status: AnalyticsConsent) {
  storage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, JSON.stringify({
    version: ANALYTICS_CONSENT_VERSION,
    status,
  }))
}
