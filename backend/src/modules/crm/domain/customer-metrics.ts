import type { CrmCustomerMetrics, CrmCustomerSegment } from '@chashka-coffee/contracts'

type MetricOrder = {
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  totalKopecks: number
  createdAt: Date
}

export function calculateCustomerMetrics(orders: readonly MetricOrder[]): CrmCustomerMetrics {
  const chronological = [...orders].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
  const paid = orders.filter((order) => order.paymentStatus === 'PAID')
  const totalSpentKopecks = paid.reduce((sum, order) => sum + order.totalKopecks, 0)
  return {
    orderCount: orders.length,
    paidOrderCount: paid.length,
    totalSpentKopecks,
    averageCheckKopecks: paid.length ? Math.round(totalSpentKopecks / paid.length) : 0,
    firstOrderAt: chronological[0]?.createdAt.toISOString() ?? null,
    lastOrderAt: chronological.at(-1)?.createdAt.toISOString() ?? null,
  }
}

export function matchesCustomerSegment(metrics: CrmCustomerMetrics, segment: CrmCustomerSegment, now: Date) {
  if (segment === 'ALL') return true
  if (segment === 'NEW') return metrics.paidOrderCount <= 1
  if (segment === 'REPEAT') return metrics.paidOrderCount >= 2
  if (segment === 'VIP') return metrics.totalSpentKopecks >= 1_000_000
  if (!metrics.lastOrderAt) return true
  const inactiveDays = segment === 'INACTIVE_30' ? 30 : 90
  return new Date(metrics.lastOrderAt).getTime() < now.getTime() - inactiveDays * 86_400_000
}
