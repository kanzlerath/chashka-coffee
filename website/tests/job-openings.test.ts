import { describe, expect, test } from 'bun:test'

import { fallbackJobOpenings, normalizeJobOpening } from '../src/lib/job-openings'

describe('public job openings', () => {
  test('ships detailed fallback copy for every vacancy dialog', () => {
    expect(fallbackJobOpenings).toHaveLength(3)

    for (const opening of fallbackJobOpenings) {
      expect(opening.description.length).toBeGreaterThan(180)
      expect(opening.description).toContain('\n')
    }
  })

  test('keeps API metadata and provides safe copy when the description is empty', () => {
    const opening = normalizeJobOpening({
      slug: 'hostess',
      title: 'Хостес',
      department: 'Ресторан',
      location: 'Красный проспект',
      employmentType: 'Сменный график',
      description: null,
    })

    expect(opening.place).toBe('Ресторан · Красный проспект')
    expect(opening.terms).toBe('Сменный график')
    expect(opening.description).toContain('Подробности роли')
  })

  test('does not present a fragment as detailed vacancy copy', () => {
    const opening = normalizeJobOpening({
      slug: 'cook',
      title: 'Повар',
      department: null,
      location: 'Новосибирск',
      employmentType: null,
      description: 'Работать на кухне',
    })

    expect(opening.description.length).toBeGreaterThan(180)
    expect(opening.description).toContain('Расскажите о своём опыте')
  })
})
