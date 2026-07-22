import { describe, expect, test } from 'bun:test'

import { formatOpeningHours } from './opening-hours'

const entry = (dayOfWeek: number, opensAt: string | null, closesAt: string | null, isClosed = false) => ({
  dayOfWeek,
  opensAt,
  closesAt,
  isClosed,
})

describe('formatOpeningHours', () => {
  test('uses one concise label when every day has the same schedule', () => {
    const hours = Array.from({ length: 7 }, (_, dayOfWeek) => entry(dayOfWeek, '08:00', '22:00'))

    expect(formatOpeningHours(hours)).toBe('Ежедневно: 08:00–22:00')
  })

  test('groups adjacent days without hiding different weekend hours', () => {
    const hours = [
      entry(0, '08:00', '22:00'),
      entry(1, '07:30', '22:00'),
      entry(2, '07:30', '22:00'),
      entry(3, '07:30', '22:00'),
      entry(4, '07:30', '22:00'),
      entry(5, '07:30', '23:00'),
      entry(6, '08:00', '23:00'),
    ]

    expect(formatOpeningHours(hours)).toBe('Пн–Чт: 07:30–22:00 · Пт: 07:30–23:00 · Сб: 08:00–23:00 · Вс: 08:00–22:00')
  })

  test('shows closed days and tolerates entries in arbitrary order', () => {
    const hours = [
      entry(6, null, null, true),
      entry(1, '10:00', '20:00'),
      entry(0, null, null, true),
      entry(5, '10:00', '20:00'),
      entry(4, '10:00', '20:00'),
      entry(3, '10:00', '20:00'),
      entry(2, '10:00', '20:00'),
    ]

    expect(formatOpeningHours(hours)).toBe('Пн–Пт: 10:00–20:00 · Сб–Вс: выходной')
  })

  test('falls back when the weekly schedule is incomplete', () => {
    expect(formatOpeningHours([entry(1, '08:00', '22:00')])).toBe('Уточняйте часы работы')
  })
})
