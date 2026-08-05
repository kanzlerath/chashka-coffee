import { describe, expect, test } from 'bun:test'

import { formatRussianPhone, isRussianPhoneComplete, normalizeRussianPhone } from '../src/lib/contact-fields'

describe('Russian phone formatting', () => {
  test('formats mobile and landline numbers with the +7 prefix', () => {
    expect(formatRussianPhone('89991234567')).toBe('+7 (999) 123-45-67')
    expect(formatRussianPhone('3831232020')).toBe('+7 (383) 123-20-20')
  })

  test('keeps partial input readable and rejects incomplete numbers', () => {
    expect(formatRussianPhone('99912')).toBe('+7 (999) 12')
    expect(normalizeRussianPhone('+7 (999) 123-45-67')).toBe('79991234567')
    expect(isRussianPhoneComplete('+7 (999) 123-45-67')).toBe(true)
    expect(isRussianPhoneComplete('+7 (999) 123')).toBe(false)
  })
})
