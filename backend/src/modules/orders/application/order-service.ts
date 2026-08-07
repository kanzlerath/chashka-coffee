import type {
  CreateOrderRequest,
  Order,
  OrderLineInput,
  OrderQuoteResponse,
  OrderStatus,
} from '@chashka-coffee/contracts'

import { OrderFailure } from '../domain/errors'
import { canTransitionOrder } from '../domain/status'
import type { Clock, OrderRepository, OrderTokens } from './ports'

export class OrderService {
  constructor(private readonly dependencies: {
    clock: Clock
    repository: OrderRepository
    tokens: OrderTokens
  }) {}

  async quote(lines: OrderLineInput[]): Promise<OrderQuoteResponse> {
    const normalized = normalizeLines(lines)
    const variants = await this.dependencies.repository.findVariants(normalized.map(({ variantId }) => variantId))
    const byId = new Map(variants.map((variant) => [variant.id, variant]))
    const now = this.dependencies.clock.now()
    const items: OrderQuoteResponse['items'] = []
    const unavailableLines: OrderQuoteResponse['unavailableLines'] = []

    for (const line of normalized) {
      const variant = byId.get(line.variantId)
      if (!variant) {
        unavailableLines.push({ variantId: line.variantId, reason: 'NOT_FOUND' })
        continue
      }
      const published = variant.productStatus === 'PUBLISHED'
        || (variant.productStatus === 'SCHEDULED' && variant.publishAt !== null && variant.publishAt <= now)
      if (!variant.isAvailable || variant.productType !== 'COFFEE' || !published) {
        unavailableLines.push({ variantId: line.variantId, reason: 'NOT_AVAILABLE' })
        continue
      }
      items.push({
        productId: variant.productId,
        productSlug: variant.productSlug,
        productName: variant.productName,
        variantId: variant.id,
        variantLabel: variant.variantLabel,
        imageUrl: variant.imageUrl,
        unitPriceKopecks: variant.unitPriceKopecks,
        quantity: line.quantity,
        totalKopecks: variant.unitPriceKopecks * line.quantity,
      })
    }

    return {
      items,
      unavailableLines,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      totalKopecks: items.reduce((sum, item) => sum + item.totalKopecks, 0),
    }
  }

  listPickupLocations() {
    return this.dependencies.repository.listPickupLocations()
  }

  async create(input: CreateOrderRequest, customerId: string | null) {
    const existing = await this.dependencies.repository.findByIdempotencyKey(input.idempotencyKey)
    if (existing) return this.creationResult(existing, input.idempotencyKey)

    const [quote, pickupLocation] = await Promise.all([
      this.quote(input.lines),
      this.dependencies.repository.findPickupLocation(input.pickupRestaurantId),
    ])
    if (quote.unavailableLines.length > 0 || quote.items.length === 0) {
      throw new OrderFailure('cart_unavailable', 'Некоторые позиции больше нельзя заказать.', quote.unavailableLines)
    }
    if (!pickupLocation) {
      throw new OrderFailure('pickup_unavailable', 'Эта точка сейчас не принимает заказы на самовывоз.')
    }

    const publicNumber = this.dependencies.tokens.publicNumber()
    const accessToken = this.dependencies.tokens.accessToken(input.idempotencyKey, publicNumber)
    const creation = await this.dependencies.repository.create({
      publicNumber,
      accessTokenHash: this.dependencies.tokens.hash(accessToken),
      idempotencyKey: input.idempotencyKey,
      customerId,
      customer: input.customer,
      pickupLocation,
      comment: input.comment,
      itemCount: quote.itemCount,
      totalKopecks: quote.totalKopecks,
      items: quote.items.map((item, position) => ({
        variantId: item.variantId,
        productName: item.productName,
        variantLabel: item.variantLabel,
        imageUrl: item.imageUrl,
        unitPriceKopecks: item.unitPriceKopecks,
        quantity: item.quantity,
        totalKopecks: item.totalKopecks,
        position,
      })),
    })
    return this.creationResult(creation.order, input.idempotencyKey)
  }

  async getByAccessToken(accessToken: string) {
    const order = await this.dependencies.repository.findByAccessTokenHash(this.dependencies.tokens.hash(accessToken))
    if (!order) throw new OrderFailure('order_not_found', 'Заказ не найден.')
    return order
  }

  listCustomerOrders(customerId: string) {
    return this.dependencies.repository.listByCustomerId(customerId)
  }

  listAdminOrders() {
    return this.dependencies.repository.listAll()
  }

  async getById(id: string) {
    const order = await this.dependencies.repository.findById(id)
    if (!order) throw new OrderFailure('order_not_found', 'Заказ не найден.')
    return order
  }

  async updateStatus(id: string, nextStatus: OrderStatus) {
    const order = await this.dependencies.repository.findById(id)
    if (!order) throw new OrderFailure('order_not_found', 'Заказ не найден.')
    if (nextStatus === 'PAID') {
      throw new OrderFailure('invalid_status_transition', 'Оплату может подтвердить только ЮKassa.')
    }
    if (nextStatus === 'CANCELLED') {
      throw new OrderFailure('invalid_status_transition', 'Отмена будет доступна вместе с безопасным возвратом оплаты.')
    }
    if (!canTransitionOrder(order.status, nextStatus)) {
      throw new OrderFailure('invalid_status_transition', 'Недопустимый переход статуса заказа.')
    }
    const updated = await this.dependencies.repository.updateStatus(id, nextStatus)
    if (!updated) throw new OrderFailure('order_not_found', 'Заказ не найден.')
    return updated
  }

  private creationResult(order: Order, idempotencyKey: string) {
    return {
      order,
      accessToken: this.dependencies.tokens.accessToken(idempotencyKey, order.publicNumber),
    }
  }
}

function normalizeLines(lines: OrderLineInput[]) {
  const quantities = new Map<string, number>()
  for (const line of lines) {
    quantities.set(line.variantId, Math.min(20, (quantities.get(line.variantId) ?? 0) + line.quantity))
  }
  return [...quantities].map(([variantId, quantity]) => ({ variantId, quantity }))
}
