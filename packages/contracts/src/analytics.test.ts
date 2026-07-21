import { describe, expect, test } from 'bun:test'

import { analyticsPageViewRequestSchema, analyticsSummaryResponseSchema } from './index'

describe('analytics contracts', () => {
  test('accepts an anonymous page view without personal data', () => {
    expect(analyticsPageViewRequestSchema.parse({
      path: '/menu',
      visitorId: 'b3d1ac58-2630-4f66-97b8-70214886811c',
      referrer: null,
      device: 'MOBILE',
    })).toEqual({
      path: '/menu',
      visitorId: 'b3d1ac58-2630-4f66-97b8-70214886811c',
      referrer: null,
      device: 'MOBILE',
    })
  })

  test('rejects arbitrary device values and invalid visitor identifiers', () => {
    expect(() => analyticsPageViewRequestSchema.parse({ path: '/', visitorId: 'visitor', device: 'WATCH' })).toThrow()
  })

  test('validates the statistics dashboard response', () => {
    expect(analyticsSummaryResponseSchema.parse({
      periodDays: 30,
      overview: { views: 3, visitors: 2, todayViews: 1, newLeads: 4 },
      daily: [{ date: '2026-07-20', views: 3, visitors: 2 }],
      topPages: [{ path: '/menu', views: 2, visitors: 2 }],
      recent: [{
        id: '21d998d6-451e-4357-9d9b-a52957039d41',
        path: '/menu',
        visitorId: 'b3d1ac58-2630-4f66-97b8-70214886811c',
        referrer: null,
        device: 'DESKTOP',
        createdAt: '2026-07-20T10:00:00.000Z',
      }],
    }).overview.visitors).toBe(2)
  })
})
