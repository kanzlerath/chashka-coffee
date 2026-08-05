import { expect, test } from 'bun:test'

import { formatRussianPhone } from '../src/lib/contact-fields'

test('restaurant phone formatter accepts a pasted local or 8-prefixed number', () => {
  expect(formatRussianPhone('3831232020')).toBe('+7 (383) 123-20-20')
  expect(formatRussianPhone('8 999 123 45 67')).toBe('+7 (999) 123-45-67')
})
