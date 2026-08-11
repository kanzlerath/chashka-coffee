import { describe, expect, test } from 'bun:test'
import type { CreateOrderRequest, Order, OrderStatus, PaymentStatus, PickupLocation } from '@chashka-coffee/contracts'

import { OrderFailure } from '../domain/errors'
import { OrderService } from './order-service'
import type { CreateOrderRecord, OrderRepository, OrderableVariant } from './ports'

const variantId = '019fc12b-7054-70f1-9dc6-10bedb28192e'
const productId = '019fc12b-7054-70f1-9dc6-10bedb28192f'
const restaurantId = '019fc12b-7054-70f1-9dc6-10bedb281930'
const orderId = '019fc12b-7054-70f1-9dc6-10bedb281931'
const itemId = '019fc12b-7054-70f1-9dc6-10bedb281932'
const idempotencyKey = '019fc12b-7054-70f1-9dc6-10bedb281933'
const customerId = '019fc12b-7054-70f1-9dc6-10bedb281934'
const otherCustomerId = '019fc12b-7054-70f1-9dc6-10bedb281935'

describe('OrderService', () => {
  test('calculates totals from current published coffee variants and reports unavailable lines', async () => {
    const repository = fakeRepository([
      variant({ id: variantId, unitPriceKopecks: 89000 }),
      variant({ id: productId, productType: 'CAKE' }),
    ])
    const service = createService(repository)

    const quote = await service.quote([
      { variantId, quantity: 2 },
      { variantId: productId, quantity: 1 },
    ])

    expect(quote.totalKopecks).toBe(178000)
    expect(quote.itemCount).toBe(2)
    expect(quote.unavailableLines).toEqual([{ variantId: productId, reason: 'NOT_AVAILABLE' }])
  })

  test('creates an immutable order once and returns the same access token on retry', async () => {
    const repository = fakeRepository([variant({ id: variantId })])
    const service = createService(repository)
    const input = checkout()

    const first = await service.create(input, null)
    const repeated = await service.create(input, null)

    expect(first.order.totalKopecks).toBe(89000)
    expect(first.order.pickupLocation.id).toBe(restaurantId)
    expect(repeated.order.id).toBe(first.order.id)
    expect(repeated.accessToken).toBe(first.accessToken)
    expect(repository.created).toHaveLength(1)
  })

  test('blocks preparation and manual payment before a verified provider event', async () => {
    const repository = fakeRepository([variant({ id: variantId })])
    const service = createService(repository)
    const created = await service.create(checkout(), null)

    await expect(service.updateStatus(created.order.id, 'PREPARING')).rejects.toBeInstanceOf(OrderFailure)
    await expect(service.updateStatus(created.order.id, 'PAID')).rejects.toThrow('только ЮKassa')
    await expect(service.updateStatus(created.order.id, 'CANCELLED')).rejects.toThrow('возвратом')
  })

  test('returns an order from the account only to the customer who created it', async () => {
    const repository = fakeRepository([variant({ id: variantId })])
    const service = createService(repository)
    const created = await service.create(checkout(), customerId)

    await expect(service.getCustomerOrder(customerId, created.order.id)).resolves.toMatchObject({ id: created.order.id })
    await expect(service.getCustomerOrder(otherCustomerId, created.order.id)).rejects.toThrow('Заказ не найден')
  })
})

function createService(repository: ReturnType<typeof fakeRepository>) {
  return new OrderService({
    clock: { now: () => new Date('2026-08-04T10:00:00.000Z') },
    repository,
    tokens: {
      publicNumber: () => 'CK-260804-A1B2C3',
      accessToken: () => 'a'.repeat(43),
      hash: (token) => `hash:${token}`,
    },
  })
}

function checkout(): CreateOrderRequest {
  return {
    lines: [{ variantId, quantity: 1 }],
    pickupRestaurantId: restaurantId,
    customer: { name: 'Анна', phone: '79131234567', email: 'anna@example.com' },
    comment: null,
    privacyAccepted: true,
    idempotencyKey,
  }
}

function variant(overrides: Partial<OrderableVariant> = {}): OrderableVariant {
  return {
    id: variantId,
    productId,
    productSlug: 'ethiopia-guji',
    productName: 'Эфиопия Гуджи',
    productType: 'COFFEE',
    productStatus: 'PUBLISHED',
    publishAt: null,
    imageUrl: '/images/coffee.webp',
    variantLabel: '250 г',
    unitPriceKopecks: 89000,
    isAvailable: true,
    ...overrides,
  }
}

const pickup: PickupLocation = {
  id: restaurantId,
  slug: 'krasny-prospekt',
  name: 'Чашка кофе — Красный проспект',
  city: 'Новосибирск',
  address: 'Красный проспект, 25',
  phone: '+7 383 000-00-00',
  openingHoursLabel: 'Ежедневно: 08:00–22:00',
}

function fakeRepository(variants: OrderableVariant[]) {
  const orders = new Map<string, Order>()
  const orderCustomerIds = new Map<string, string | null>()
  const created: CreateOrderRecord[] = []
  const repository: OrderRepository & { created: CreateOrderRecord[] } = {
    created,
    async findVariants(ids) { return variants.filter((item) => ids.includes(item.id)) },
    async listPickupLocations() { return [pickup] },
    async findPickupLocation(id) { return id === pickup.id ? pickup : null },
    async findByIdempotencyKey(key) { return orders.get(key) ?? null },
    async findById(id) { return [...orders.values()].find((order) => order.id === id) ?? null },
    async findByIdAndCustomerId(id, customerId) {
      const order = [...orders.values()].find((candidate) => candidate.id === id)
      return order && orderCustomerIds.get(order.id) === customerId ? order : null
    },
    async create(input) {
      created.push(input)
      const order = recordToOrder(input)
      orders.set(input.idempotencyKey, order)
      orderCustomerIds.set(order.id, input.customerId)
      return { order, created: true }
    },
    async findByAccessTokenHash() { return null },
    async listByCustomerId() { return [...orders.values()] },
    async listAll() { return [...orders.values()] },
    async updateStatus(id, status: OrderStatus, paymentStatus?: PaymentStatus) {
      const current = [...orders.entries()].find(([, order]) => order.id === id)
      if (!current) return null
      const updated = { ...current[1], status, paymentStatus: paymentStatus ?? current[1].paymentStatus }
      orders.set(current[0], updated)
      return updated
    },
  }
  return repository
}

function recordToOrder(input: CreateOrderRecord): Order {
  return {
    id: orderId,
    publicNumber: input.publicNumber,
    status: 'AWAITING_PAYMENT',
    paymentStatus: 'PENDING',
    customer: input.customer,
    pickupLocation: input.pickupLocation,
    items: input.items.map((item) => ({ id: itemId, ...item })),
    itemCount: input.itemCount,
    totalKopecks: input.totalKopecks,
    comment: input.comment,
    createdAt: '2026-08-04T10:00:00.000Z',
    updatedAt: '2026-08-04T10:00:00.000Z',
  }
}
