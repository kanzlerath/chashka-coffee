import { describe, expect, test } from 'bun:test'

import { calculateCustomerMetrics, matchesCustomerSegment } from './customer-metrics'

describe('CRM customer metrics', () => {
  const now = new Date('2026-08-05T12:00:00.000Z')
  const orders = [
    { paymentStatus: 'PAID' as const, totalKopecks: 50_000, createdAt: new Date('2026-06-01T10:00:00.000Z') },
    { paymentStatus: 'PAID' as const, totalKopecks: 90_000, createdAt: new Date('2026-08-01T10:00:00.000Z') },
    { paymentStatus: 'REFUNDED' as const, totalKopecks: 40_000, createdAt: new Date('2026-08-02T10:00:00.000Z') },
  ]

  test('counts only paid orders in revenue and average check', () => {
    expect(calculateCustomerMetrics(orders)).toEqual({
      orderCount: 3,
      paidOrderCount: 2,
      totalSpentKopecks: 140_000,
      averageCheckKopecks: 70_000,
      firstOrderAt: '2026-06-01T10:00:00.000Z',
      lastOrderAt: '2026-08-02T10:00:00.000Z',
    })
  })

  test('uses stable segment definitions', () => {
    const metrics = calculateCustomerMetrics(orders)
    expect(matchesCustomerSegment(metrics, 'REPEAT', now)).toBe(true)
    expect(matchesCustomerSegment(metrics, 'INACTIVE_30', now)).toBe(false)
    expect(matchesCustomerSegment({ ...metrics, lastOrderAt: '2026-06-01T10:00:00.000Z' }, 'INACTIVE_30', now)).toBe(true)
  })
})
