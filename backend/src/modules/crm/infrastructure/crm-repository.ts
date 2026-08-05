import type {
  CrmAnalyticsResponse,
  CrmCustomerDetail,
  CrmCustomerListQuery,
  CrmCustomerNote,
  CrmCustomerSummary,
  CrmTag,
  Lead,
  Order,
  UpdateCrmCustomerRequest,
} from '@chashka-coffee/contracts'

import type { DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import { calculateCustomerMetrics, matchesCustomerSegment } from '../domain/customer-metrics'
import { CrmConflict } from '../domain/errors'

type MetricOrder = { paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'; totalKopecks: number; createdAt: Date }
type TagRecord = { id: string; name: string; color: string | null; createdAt: Date; updatedAt: Date }

export class CrmRepository {
  constructor(private readonly db: DbClient, private readonly now: () => Date = () => new Date()) {}

  async listCustomers(query: CrmCustomerListQuery) {
    const contains = query.q ? { contains: query.q, mode: 'insensitive' as const } : undefined
    const records = await this.db.customer.findMany({
      where: {
        status: query.status,
        ...(contains ? { OR: [{ name: contains }, { phone: contains }, { email: contains }] } : {}),
      },
      include: {
        orders: { select: { paymentStatus: true, totalKopecks: true, createdAt: true } },
        tags: { include: { tag: true } },
      },
    })
    const filtered = records
      .map((record) => customerSummary(record))
      .filter((customer) => matchesCustomerSegment(customer.metrics, query.segment, this.now()))
      .sort(customerComparator(query.sort))
    const offset = (query.page - 1) * query.pageSize
    return { customers: filtered.slice(offset, offset + query.pageSize), total: filtered.length, page: query.page, pageSize: query.pageSize }
  }

  async getCustomer(id: string): Promise<CrmCustomerDetail | null> {
    const customer = await this.db.customer.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        orders: { include: { items: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' } },
        leads: { orderBy: { createdAt: 'desc' } },
        notes: { include: { author: { select: { id: true, displayName: true, email: true } } }, orderBy: { createdAt: 'desc' } },
        consents: { orderBy: { channel: 'asc' } },
      },
    })
    if (!customer) return null
    return {
      ...customerSummary(customer),
      orders: customer.orders.map(orderDto),
      leads: customer.leads.map(leadDto),
      notes: customer.notes.map(noteDto),
      consents: customer.consents.map((consent) => ({
        id: consent.id,
        channel: consent.channel,
        status: consent.status,
        source: consent.source,
        grantedAt: consent.grantedAt?.toISOString() ?? null,
        withdrawnAt: consent.withdrawnAt?.toISOString() ?? null,
        updatedAt: consent.updatedAt.toISOString(),
      })),
    }
  }

  async updateCustomer(id: string, input: UpdateCrmCustomerRequest) {
    const result = await this.db.customer.updateMany({ where: { id }, data: input })
    return result.count ? this.getCustomer(id) : null
  }

  async createNote(customerId: string, authorId: string, body: string): Promise<CrmCustomerNote | null> {
    if (!await this.db.customer.count({ where: { id: customerId } })) return null
    const note = await this.db.customerNote.create({
      data: { customerId, authorId, body },
      include: { author: { select: { id: true, displayName: true, email: true } } },
    })
    return noteDto(note)
  }

  async deleteNote(customerId: string, noteId: string) {
    const result = await this.db.customerNote.deleteMany({ where: { id: noteId, customerId } })
    return result.count > 0
  }

  async listTags(): Promise<CrmTag[]> {
    return (await this.db.customerTag.findMany({ orderBy: { name: 'asc' } })).map(tagDto)
  }

  async createTag(name: string, color: string | null) {
    try {
      return tagDto(await this.db.customerTag.create({ data: { name, color } }))
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new CrmConflict('Tag name already exists')
      throw error
    }
  }

  async deleteTag(id: string) {
    return (await this.db.customerTag.deleteMany({ where: { id } })).count > 0
  }

  async setCustomerTags(customerId: string, tagIds: string[]) {
    return this.db.$transaction(async (tx) => {
      if (!await tx.customer.count({ where: { id: customerId } })) return null
      const existingTags = await tx.customerTag.count({ where: { id: { in: tagIds } } })
      if (existingTags !== tagIds.length) return 'INVALID_TAGS' as const
      await tx.customerTagAssignment.deleteMany({ where: { customerId } })
      if (tagIds.length) {
        await tx.customerTagAssignment.createMany({ data: tagIds.map((tagId) => ({ customerId, tagId })) })
      }
      return 'UPDATED' as const
    })
  }

  async analytics(periodDays: number): Promise<CrmAnalyticsResponse> {
    const now = this.now()
    const since = startOfUtcDay(new Date(now.getTime() - (periodDays - 1) * 86_400_000))
    const previousSince = new Date(since.getTime() - periodDays * 86_400_000)
    const [currentOrders, previousOrders, allPaidCustomerOrders] = await Promise.all([
      this.db.order.findMany({
        where: { createdAt: { gte: since } },
        select: {
          status: true, paymentStatus: true, totalKopecks: true, createdAt: true, crmCustomerId: true, pickupName: true,
          items: { select: { productName: true, quantity: true, totalKopecks: true } },
        },
      }),
      this.db.order.findMany({ where: { createdAt: { gte: previousSince, lt: since }, paymentStatus: 'PAID' }, select: { totalKopecks: true } }),
      this.db.order.findMany({ where: { paymentStatus: 'PAID', crmCustomerId: { not: null } }, select: { crmCustomerId: true, createdAt: true } }),
    ])
    const paid = currentOrders.filter((order) => order.paymentStatus === 'PAID')
    const revenueKopecks = sum(paid.map((order) => order.totalKopecks))
    const priorCustomers = new Set(allPaidCustomerOrders.filter((order) => order.createdAt < since).map((order) => order.crmCustomerId!))
    const currentCustomers = new Set(paid.flatMap((order) => order.crmCustomerId ? [order.crmCustomerId] : []))
    const lifetimeCounts = new Map<string, number>()
    for (const order of allPaidCustomerOrders) lifetimeCounts.set(order.crmCustomerId!, (lifetimeCounts.get(order.crmCustomerId!) ?? 0) + 1)
    const daily = new Map<string, { revenueKopecks: number; paidOrders: number; customers: Set<string> }>()
    for (let offset = 0; offset < periodDays; offset += 1) {
      daily.set(new Date(since.getTime() + offset * 86_400_000).toISOString().slice(0, 10), { revenueKopecks: 0, paidOrders: 0, customers: new Set() })
    }
    const products = new Map<string, { quantity: number; revenueKopecks: number }>()
    const locations = new Map<string, { paidOrders: number; revenueKopecks: number }>()
    for (const order of paid) {
      const point = daily.get(order.createdAt.toISOString().slice(0, 10))
      if (point) {
        point.revenueKopecks += order.totalKopecks
        point.paidOrders += 1
        if (order.crmCustomerId && !priorCustomers.has(order.crmCustomerId)) point.customers.add(order.crmCustomerId)
      }
      const location = locations.get(order.pickupName) ?? { paidOrders: 0, revenueKopecks: 0 }
      location.paidOrders += 1
      location.revenueKopecks += order.totalKopecks
      locations.set(order.pickupName, location)
      for (const item of order.items) {
        const product = products.get(item.productName) ?? { quantity: 0, revenueKopecks: 0 }
        product.quantity += item.quantity
        product.revenueKopecks += item.totalKopecks
        products.set(item.productName, product)
      }
    }
    const customersWithOrders = lifetimeCounts.size
    const repeatCustomers = [...lifetimeCounts.values()].filter((count) => count >= 2).length
    return {
      periodDays,
      overview: {
        revenueKopecks,
        paidOrders: paid.length,
        averageCheckKopecks: paid.length ? Math.round(revenueKopecks / paid.length) : 0,
        newCustomers: [...currentCustomers].filter((id) => !priorCustomers.has(id)).length,
        returningCustomers: [...currentCustomers].filter((id) => priorCustomers.has(id)).length,
        repeatRatePercent: customersWithOrders ? Math.round((repeatCustomers / customersWithOrders) * 1_000) / 10 : 0,
        cancelledOrders: currentOrders.filter((order) => order.status === 'CANCELLED').length,
      },
      previous: { revenueKopecks: sum(previousOrders.map((order) => order.totalKopecks)), paidOrders: previousOrders.length },
      daily: [...daily].map(([date, point]) => ({ date, revenueKopecks: point.revenueKopecks, paidOrders: point.paidOrders, newCustomers: point.customers.size })),
      topProducts: [...products].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.revenueKopecks - a.revenueKopecks).slice(0, 10),
      topPickupLocations: [...locations].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.revenueKopecks - a.revenueKopecks).slice(0, 10),
    }
  }
}

function customerSummary(record: {
  id: string; name: string; phone: string; email: string | null; status: 'ACTIVE' | 'ARCHIVED'; createdAt: Date; updatedAt: Date
  orders: MetricOrder[]; tags: Array<{ tag: TagRecord }>
}): CrmCustomerSummary {
  return {
    id: record.id, name: record.name, phone: record.phone, email: record.email, status: record.status,
    createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    tags: record.tags.map(({ tag }) => tagDto(tag)), metrics: calculateCustomerMetrics(record.orders),
  }
}

function customerComparator(sort: CrmCustomerListQuery['sort']) {
  return (left: CrmCustomerSummary, right: CrmCustomerSummary) => {
    if (sort === 'TOTAL_SPENT_DESC') return right.metrics.totalSpentKopecks - left.metrics.totalSpentKopecks
    if (sort === 'ORDER_COUNT_DESC') return right.metrics.orderCount - left.metrics.orderCount
    if (sort === 'NEWEST_DESC') return right.createdAt.localeCompare(left.createdAt)
    return (right.metrics.lastOrderAt ?? '').localeCompare(left.metrics.lastOrderAt ?? '')
  }
}

function tagDto(tag: TagRecord): CrmTag {
  return { ...tag, createdAt: tag.createdAt.toISOString(), updatedAt: tag.updatedAt.toISOString() }
}

function noteDto(note: { id: string; body: string; author: { id: string; displayName: string | null; email: string } | null; createdAt: Date; updatedAt: Date }): CrmCustomerNote {
  return { id: note.id, body: note.body, author: note.author, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() }
}

function leadDto(lead: { id: string; type: Lead['type']; status: Lead['status']; name: string; phone: string | null; email: string | null; message: string | null; payload: unknown; createdAt: Date; updatedAt: Date }): Lead {
  return {
    id: lead.id, type: lead.type, status: lead.status, name: lead.name, phone: lead.phone, email: lead.email, message: lead.message,
    metadata: readMetadata(lead.payload), createdAt: lead.createdAt.toISOString(), updatedAt: lead.updatedAt.toISOString(),
  }
}

function orderDto(order: {
  id: string; publicNumber: string; status: Order['status']; paymentStatus: Order['paymentStatus']; customerName: string; customerPhone: string; customerEmail: string | null
  pickupRestaurantId: string | null; pickupSlug: string; pickupName: string; pickupCity: string; pickupAddress: string; pickupPhone: string; pickupOpeningHoursLabel: string
  itemCount: number; totalKopecks: number; comment: string | null; createdAt: Date; updatedAt: Date
  items: Array<{ id: string; variantId: string | null; productName: string; variantLabel: string; imageUrl: string | null; unitPriceKopecks: number; quantity: number; totalKopecks: number }>
}): Order {
  return {
    id: order.id, publicNumber: order.publicNumber, status: order.status, paymentStatus: order.paymentStatus,
    customer: { name: order.customerName, phone: order.customerPhone, email: order.customerEmail },
    pickupLocation: { id: order.pickupRestaurantId, slug: order.pickupSlug, name: order.pickupName, city: order.pickupCity, address: order.pickupAddress, phone: order.pickupPhone, openingHoursLabel: order.pickupOpeningHoursLabel },
    items: order.items.map((item) => ({ id: item.id, variantId: item.variantId, productName: item.productName, variantLabel: item.variantLabel, imageUrl: item.imageUrl, unitPriceKopecks: item.unitPriceKopecks, quantity: item.quantity, totalKopecks: item.totalKopecks })),
    itemCount: order.itemCount, totalKopecks: order.totalKopecks, comment: order.comment, createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString(),
  }
}

function readMetadata(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  return entries.length ? Object.fromEntries(entries) : null
}

function startOfUtcDay(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())) }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0) }
