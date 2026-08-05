import type { Order, OrderStatus, PaymentStatus, PickupLocation } from '@chashka-coffee/contracts'

import type { DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import type { CreateOrderRecord, OrderRepository } from '../application/ports'

const includeItems = { items: { orderBy: { position: 'asc' as const } } }

type OrderRecord = {
  id: string
  publicNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  customerName: string
  customerPhone: string
  customerEmail: string | null
  pickupRestaurantId: string | null
  pickupSlug: string
  pickupName: string
  pickupCity: string
  pickupAddress: string
  pickupPhone: string
  pickupOpeningHoursLabel: string
  itemCount: number
  totalKopecks: number
  comment: string | null
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    variantId: string | null
    productName: string
    variantLabel: string
    imageUrl: string | null
    unitPriceKopecks: number
    quantity: number
    totalKopecks: number
  }>
}

function toOrder(record: OrderRecord): Order {
  return {
    id: record.id,
    publicNumber: record.publicNumber,
    status: record.status,
    paymentStatus: record.paymentStatus,
    customer: {
      name: record.customerName,
      phone: record.customerPhone,
      email: record.customerEmail,
    },
    pickupLocation: {
      id: record.pickupRestaurantId,
      slug: record.pickupSlug,
      name: record.pickupName,
      city: record.pickupCity,
      address: record.pickupAddress,
      phone: record.pickupPhone,
      openingHoursLabel: record.pickupOpeningHoursLabel,
    },
    items: record.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productName: item.productName,
      variantLabel: item.variantLabel,
      imageUrl: item.imageUrl,
      unitPriceKopecks: item.unitPriceKopecks,
      quantity: item.quantity,
      totalKopecks: item.totalKopecks,
    })),
    itemCount: record.itemCount,
    totalKopecks: record.totalKopecks,
    comment: record.comment,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function formatPickupHours(entries: Array<{ dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }>) {
  const open = entries.filter((entry) => !entry.isClosed && entry.opensAt && entry.closesAt)
  if (open.length !== 7) return 'Уточняйте часы работы'
  if (open.every((entry) => entry.opensAt === open[0]?.opensAt && entry.closesAt === open[0]?.closesAt)) {
    return `Ежедневно: ${open[0]!.opensAt}–${open[0]!.closesAt}`
  }
  return 'График указан на странице ресторана'
}

function toPickupLocation(restaurant: {
  id: string
  slug: string
  name: string
  city: string
  address: string
  phone: string
  openingHours: Array<{ dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }>
}): PickupLocation {
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    city: restaurant.city,
    address: restaurant.address,
    phone: restaurant.phone,
    openingHoursLabel: formatPickupHours(restaurant.openingHours),
  }
}

export function createPrismaOrderRepository(db: DbClient): OrderRepository {
  return {
    async findVariants(ids) {
      const variants = await db.productVariant.findMany({
        where: { id: { in: ids } },
        include: { product: true },
      })
      return variants.map((variant) => ({
        id: variant.id,
        productId: variant.product.id,
        productSlug: variant.product.slug,
        productName: variant.product.name,
        productType: variant.product.type,
        productStatus: variant.product.status,
        publishAt: variant.product.publishAt,
        imageUrl: variant.product.imageUrl,
        variantLabel: variant.label,
        unitPriceKopecks: variant.priceKopecks,
        isAvailable: variant.isAvailable,
      }))
    },

    async listPickupLocations() {
      const restaurants = await db.restaurant.findMany({
        where: { coffeePickupEnabled: true },
        include: { openingHours: { orderBy: { dayOfWeek: 'asc' } } },
        orderBy: [{ city: 'asc' }, { name: 'asc' }],
      })
      return restaurants.map(toPickupLocation)
    },

    async findPickupLocation(id) {
      const restaurant = await db.restaurant.findFirst({
        where: { id, coffeePickupEnabled: true },
        include: { openingHours: { orderBy: { dayOfWeek: 'asc' } } },
      })
      return restaurant ? toPickupLocation(restaurant) : null
    },

    async findByIdempotencyKey(key) {
      const order = await db.order.findUnique({ where: { idempotencyKey: key }, include: includeItems })
      return order ? toOrder(order as OrderRecord) : null
    },

    async findById(id) {
      const order = await db.order.findUnique({ where: { id }, include: includeItems })
      return order ? toOrder(order as OrderRecord) : null
    },

    async create(input: CreateOrderRecord) {
      try {
        const order = await db.order.create({
          data: {
            publicNumber: input.publicNumber,
            accessTokenHash: input.accessTokenHash,
            idempotencyKey: input.idempotencyKey,
            customerId: input.customerId,
            pickupRestaurantId: input.pickupLocation.id,
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            customerEmail: input.customer.email,
            pickupSlug: input.pickupLocation.slug,
            pickupName: input.pickupLocation.name,
            pickupCity: input.pickupLocation.city,
            pickupAddress: input.pickupLocation.address,
            pickupPhone: input.pickupLocation.phone,
            pickupOpeningHoursLabel: input.pickupLocation.openingHoursLabel,
            itemCount: input.itemCount,
            totalKopecks: input.totalKopecks,
            comment: input.comment,
            items: { create: input.items },
          },
          include: includeItems,
        })
        return toOrder(order as OrderRecord)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: includeItems })
          if (existing) return toOrder(existing as OrderRecord)
        }
        throw error
      }
    },

    async findByAccessTokenHash(hash) {
      const order = await db.order.findUnique({ where: { accessTokenHash: hash }, include: includeItems })
      return order ? toOrder(order as OrderRecord) : null
    },

    async listByCustomerId(customerId) {
      const orders = await db.order.findMany({
        where: { customerId },
        include: includeItems,
        orderBy: { createdAt: 'desc' },
      })
      return orders.map((order) => toOrder(order as OrderRecord))
    },

    async listAll() {
      const orders = await db.order.findMany({ include: includeItems, orderBy: { createdAt: 'desc' } })
      return orders.map((order) => toOrder(order as OrderRecord))
    },

    async updateStatus(id, status, paymentStatus) {
      try {
        const order = await db.order.update({
          where: { id },
          data: { status, ...(paymentStatus ? { paymentStatus } : {}) },
          include: includeItems,
        })
        return toOrder(order as OrderRecord)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null
        throw error
      }
    },
  }
}
