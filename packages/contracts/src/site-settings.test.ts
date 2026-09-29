import { describe, expect, test } from 'bun:test'

import { siteSettingsResponseSchema, upsertSiteSettingsRequestSchema } from './site-settings'

describe('shared site settings contracts', () => {
  test('accepts editable raster previews for the global header', () => {
    const request = upsertSiteSettingsRequestSchema.parse({
      headerPreviews: [{
        id: 'service-delivery',
        label: 'Доставка',
        href: '/delivery',
        imageUrl: '/images/delivery.webp',
        imageAlt: 'Курьер с заказом',
      }],
    })
    expect(request.headerPreviews[0]?.id).toBe('service-delivery')
    expect(request.coffeeOrdersEnabled).toBe(true)
    expect(siteSettingsResponseSchema.parse({ settings: { ...request, updatedAt: '2026-08-06T04:00:00.000Z' } }).settings.headerPreviews).toHaveLength(1)
  })

  test('accepts disabling online coffee orders', () => {
    const request = upsertSiteSettingsRequestSchema.parse({ headerPreviews: [], coffeeOrdersEnabled: false })
    expect(request.coffeeOrdersEnabled).toBe(false)
  })

  test('rejects unsafe or empty image addresses', () => {
    expect(upsertSiteSettingsRequestSchema.safeParse({ headerPreviews: [{ id: 'x', label: 'X', href: '/', imageUrl: 'javascript:alert(1)', imageAlt: '' }] }).success).toBe(false)
  })

  test('keeps page and footer contacts editable with validated addresses', () => {
    const base = { headerPreviews: [], contactCards: [{ title: 'Банкеты', phone: '+7 (383) 123-20-20', email: 'events@chashkacoffee.ru', hours: 'Ежедневно' }], footerContact: { phone: '+7 (383) 123-20-20', email: 'hello@chashkacoffee.ru' } }
    expect(upsertSiteSettingsRequestSchema.safeParse(base).success).toBe(true)
    expect(upsertSiteSettingsRequestSchema.safeParse({ ...base, footerContact: { ...base.footerContact, email: 'invalid' } }).success).toBe(false)
    expect(upsertSiteSettingsRequestSchema.safeParse({ ...base, contactCards: [{ ...base.contactCards[0], phone: '12345' }] }).success).toBe(false)
  })
})
