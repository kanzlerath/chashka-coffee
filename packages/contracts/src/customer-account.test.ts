import { describe, expect, test } from 'bun:test'

import {
  customerPhoneSchema,
  customerProfileSchema,
  customerQrResponseSchema,
  customerSendCodeRequestSchema,
  customerVerifyCodeRequestSchema,
} from './index'

describe('customer account contracts', () => {
  test('normalizes common Russian phone input without accepting ambiguous numbers', () => {
    expect(customerPhoneSchema.parse('+7 (913) 123-45-67')).toBe('79131234567')
    expect(customerPhoneSchema.parse('8 913 123 45 67')).toBe('79131234567')
    expect(customerPhoneSchema.parse('9131234567')).toBe('79131234567')
    expect(() => customerPhoneSchema.parse('12345')).toThrow('Укажите российский номер телефона')
  })

  test('keeps the SMS challenge explicit and accepts only numeric confirmation codes', () => {
    expect(customerSendCodeRequestSchema.parse({ phone: '8 913 123-45-67' })).toEqual({
      phone: '79131234567',
    })
    expect(customerVerifyCodeRequestSchema.parse({
      challengeId: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      code: ' 1234 ',
    })).toEqual({
      challengeId: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      code: '1234',
    })
    expect(() => customerVerifyCodeRequestSchema.parse({
      challengeId: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      code: '12ab',
    })).toThrow('Введите код из SMS')
  })

  test('validates the read-only profile and generated QR payload', () => {
    const customer = {
      id: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      phone: '79131234567',
      name: 'Анна',
      surname: 'Иванова',
      middleName: null,
      email: null,
      cardNumber: '123456',
      balance: 725.5,
    }

    expect(customerProfileSchema.parse(customer)).toEqual(customer)
    expect(customerQrResponseSchema.parse({
      value: '481516',
      generatedAt: '2026-08-02T07:00:00.000Z',
    })).toEqual({
      value: '481516',
      generatedAt: '2026-08-02T07:00:00.000Z',
    })
  })
})

