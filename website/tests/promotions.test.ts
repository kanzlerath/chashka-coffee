import { describe, expect, test } from 'bun:test'

import { promotionAction, promotionPeriodLabel } from '../src/lib/promotions'

describe('promotion presentation', () => {
  test('uses the configured button label and destination', () => {
    expect(promotionAction({
      slug: 'weekday-breakfasts',
      ctaLabel: 'Открыть меню',
      ctaUrl: '/menu',
    })).toEqual({ label: 'Открыть меню', href: '/menu', external: false })
  })

  test('keeps the detail page reachable when the button is not configured', () => {
    expect(promotionAction({
      slug: 'weekday-breakfasts',
      ctaLabel: null,
      ctaUrl: null,
    })).toEqual({ label: 'Подробнее', href: '/promotions/weekday-breakfasts', external: false })
  })

  test('marks an absolute button destination as external', () => {
    expect(promotionAction({
      slug: 'summer-offer',
      ctaLabel: null,
      ctaUrl: 'https://example.com/offer',
    })).toEqual({ label: 'Подробнее', href: 'https://example.com/offer', external: true })
  })

  test('formats the promotion period without an eyebrow-style fallback', () => {
    expect(promotionPeriodLabel({ startsAt: null, endsAt: '2026-08-31T05:00:00.000Z' })).toBe('До 31 августа')
    expect(promotionPeriodLabel({ startsAt: null, endsAt: null })).toBe('Актуальное предложение')
  })
})
