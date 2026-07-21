import { describe, expect, test } from 'bun:test'

import { nullableDraftText } from '../src/lib/form-drafts'

describe('nullableDraftText', () => {
  test('preserves spaces while a person is typing', () => {
    expect(nullableDraftText('Новый ресторан ')).toBe('Новый ресторан ')
    expect(nullableDraftText('Кофе с молоком')).toBe('Кофе с молоком')
  })

  test('maps only an actually empty field to null', () => {
    expect(nullableDraftText('')).toBeNull()
    expect(nullableDraftText(' ')).toBe(' ')
  })
})
