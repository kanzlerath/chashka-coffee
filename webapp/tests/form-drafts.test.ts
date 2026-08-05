import { describe, expect, test } from 'bun:test'

import { formDraftStorageKey, nullableDraftText, parseStoredFormDraft, serializeFormDraft } from '../src/lib/form-drafts'

describe('nullableDraftText', () => {
  test('preserves spaces while a person is typing', () => {
    expect(nullableDraftText('Новый ресторан ')).toBe('Новый ресторан ')
    expect(nullableDraftText('Кофе с молоком')).toBe('Кофе с молоком')
  })

  test('maps only an actually empty field to null', () => {
    expect(nullableDraftText('')).toBeNull()
    expect(nullableDraftText(' ')).toBe(' ')
  })

  test('round-trips a versioned editor draft and ignores corrupt storage', () => {
    const raw = serializeFormDraft('2026-08-03T09:00:00.000Z', { title: 'Новый заголовок' }, '2026-08-03T09:05:00.000Z')
    expect(parseStoredFormDraft<{ title: string }>(raw)).toEqual({
      sourceVersion: '2026-08-03T09:00:00.000Z',
      savedAt: '2026-08-03T09:05:00.000Z',
      value: { title: 'Новый заголовок' },
    })
    expect(parseStoredFormDraft('{broken')).toBeNull()
    expect(formDraftStorageKey('content:1')).toBe('chashka-admin:draft:content:1')
  })
})
