import { describe, expect, test } from 'bun:test'

import {
  createOrderRequestSchema,
  orderQuoteRequestSchema,
  pickupLocationListResponseSchema,
  updateOrderStatusRequestSchema,
} from './orders'

const variantId = '019fc12b-7054-70f1-9dc6-10bedb28192e'
const restaurantId = '019fc12b-7054-70f1-9dc6-10bedb28192f'
const idempotencyKey = '019fc12b-7054-70f1-9dc6-10bedb281930'

describe('online coffee order contracts', () => {
  test('keeps cart input limited to variant identity and quantity', () => {
    expect(orderQuoteRequestSchema.parse({ lines: [{ variantId, quantity: 2 }] })).toEqual({
      lines: [{ variantId, quantity: 2 }],
    })
    expect(() => orderQuoteRequestSchema.parse({
      lines: [{ variantId, quantity: 1, unitPriceKopecks: 1 }],
    })).toThrow()
  })

  test('normalizes checkout contact data and requires explicit consent', () => {
    const parsed = createOrderRequestSchema.parse({
      lines: [{ variantId, quantity: 2 }],
      pickupRestaurantId: restaurantId,
      customer: { name: ' Анна ', phone: '+7 (913) 123-45-67', email: 'anna@example.com' },
      comment: null,
      privacyAccepted: true,
      idempotencyKey,
    })

    expect(parsed.customer).toEqual({ name: 'Анна', phone: '79131234567', email: 'anna@example.com' })
    expect(() => createOrderRequestSchema.parse({ ...parsed, privacyAccepted: false })).toThrow()
    expect(() => createOrderRequestSchema.parse({
      ...parsed,
      customer: { ...parsed.customer, email: null },
    })).toThrow()
  })

  test('rejects impossible quantities and unknown operational statuses', () => {
    expect(() => orderQuoteRequestSchema.parse({ lines: [{ variantId, quantity: 0 }] })).toThrow()
    expect(() => updateOrderStatusRequestSchema.parse({ status: 'DELIVERING' })).toThrow()
  })

  test('keeps pickup coordinates with the location used by the checkout map', () => {
    expect(pickupLocationListResponseSchema.parse({ locations: [{
      id: restaurantId,
      slug: 'lenina',
      name: 'Чашка кофе — Ленина',
      city: 'Новосибирск',
      address: 'Ленина, 12/2',
      phone: '+7 383 000-00-00',
      openingHoursLabel: 'Ежедневно: 08:00–22:00',
      latitude: 55.028,
      longitude: 82.919,
    }] })).toMatchObject({ locations: [{ latitude: 55.028, longitude: 82.919 }] })
  })
})
