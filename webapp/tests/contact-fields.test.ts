import { expect, test } from 'bun:test'

import { formatRussianPhone, russianPhonePattern } from '../src/lib/contact-fields'

test('restaurant phone formatter accepts a pasted local or 8-prefixed number', () => {
  expect(formatRussianPhone('3831232020')).toBe('+7 (383) 123-20-20')
  expect(formatRussianPhone('8 999 123 45 67')).toBe('+7 (999) 123-45-67')
})

test('restaurant phone field accepts the formatter output', () => {
  const fieldPattern = new RegExp(`^(?:${russianPhonePattern})$`)

  expect(fieldPattern.test(formatRussianPhone('3831232020'))).toBe(true)
  expect(fieldPattern.test('+7 (383) 123-20')).toBe(false)
})
