import { describe, expect, test } from 'bun:test'
import { matchesMenuSearch } from '../src/lib/menu-search'

describe('matchesMenuSearch', () => {
  test('matches dish names and categories without depending on case or extra spaces', () => {
    expect(matchesMenuSearch('  КАПУЧИНО ', ['Кофе', 'Капучино'])).toBeTrue()
    expect(matchesMenuSearch('горячее', ['Горячее', 'Шакшука с томатами'])).toBeTrue()
  })

  test('treats е and ё as the same letter', () => {
    expect(matchesMenuSearch('сырнички с вареньем', ['Сырнички с вареньём'])).toBeTrue()
  })

  test('keeps every dish visible for an empty query', () => {
    expect(matchesMenuSearch('   ', ['Капучино'])).toBeTrue()
  })

  test('rejects dishes that do not contain the query', () => {
    expect(matchesMenuSearch('латте', ['Кофе', 'Капучино'])).toBeFalse()
  })
})
