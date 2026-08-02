import { describe, expect, test } from 'bun:test'

import { formatMenuPortion } from '../src/lib/menu-portion'

describe('menu portion formatting', () => {
  test('formats weight, volume and pieces with their own units', () => {
    expect(formatMenuPortion(220, 'GRAM')).toBe('220 г')
    expect(formatMenuPortion(300, 'MILLILITER')).toBe('300 мл')
    expect(formatMenuPortion(2, 'PIECE')).toBe('2 шт.')
  })

  test('uses a neutral fallback when no portion size is configured', () => {
    expect(formatMenuPortion(null, 'GRAM')).toBe('1 порция')
  })
})
