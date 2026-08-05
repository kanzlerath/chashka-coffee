/** Keep the editor value intact while typing; API schemas normalize it on save. */
export function nullableDraftText(value: string): string | null {
  return value === '' ? null : value
}

export type StoredFormDraft<T> = {
  sourceVersion: string
  savedAt: string
  value: T
}

export function formDraftStorageKey(key: string) {
  return `chashka-admin:draft:${key}`
}

export function parseStoredFormDraft<T>(raw: string | null): StoredFormDraft<T> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredFormDraft<T>>
    if (typeof parsed.sourceVersion !== 'string' || typeof parsed.savedAt !== 'string' || !('value' in parsed)) return null
    if (Number.isNaN(Date.parse(parsed.savedAt))) return null
    return parsed as StoredFormDraft<T>
  } catch {
    return null
  }
}

export function serializeFormDraft<T>(sourceVersion: string, value: T, savedAt = new Date().toISOString()) {
  return JSON.stringify({ sourceVersion, savedAt, value } satisfies StoredFormDraft<T>)
}
