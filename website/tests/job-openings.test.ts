import { describe, expect, test } from 'bun:test'

import { fallbackJobOpenings, normalizeJobOpening } from '../src/lib/job-openings'

describe('public job openings', () => {
  test('ships concise fallback copy for inline vacancy details', () => {
    expect(fallbackJobOpenings).toHaveLength(3)

    for (const opening of fallbackJobOpenings) {
      expect(opening.description.length).toBeGreaterThan(80)
      expect(opening.description).toContain('\n')
    }
  })

  test('uses the linked restaurant name and address in public metadata', () => {
    const opening = normalizeJobOpening({
      slug: 'hostess',
      title: 'Хостес',
      department: 'Ресторан',
      location: 'Красный проспект',
      employmentType: 'Сменный график',
      description: null,
      restaurant: { id: '019b2f38-d85f-7d4d-ae74-154350f5f899', name: 'Чашка кофе', address: 'Красный проспект, 25' },
    })

    expect(opening.place).toBe('Чашка кофе · Красный проспект, 25')
    expect(opening.terms).toBe('Сменный график')
    expect(opening.description).toContain('Условия и задачи')
  })

  test('keeps concise editor copy instead of replacing it with filler', () => {
    const opening = normalizeJobOpening({
      slug: 'cook',
      title: 'Повар',
      department: null,
      location: 'Новосибирск',
      employmentType: null,
      description: 'Работать на кухне',
      restaurant: null,
    })

    expect(opening.description).toBe('Работать на кухне')
  })
})
