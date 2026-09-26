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
})
