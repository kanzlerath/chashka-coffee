import type { Order, OrderCustomer, OrderStatus, PaymentStatus, PickupLocation } from '@chashka-coffee/contracts'

export type OrderableVariant = {
  id: string
  productId: string
  productSlug: string
  productName: string
  productType: 'COFFEE' | 'CAKE'
  productStatus: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'
  publishAt: Date | null
  imageUrl: string | null
  variantLabel: string
  unitPriceKopecks: number
  isAvailable: boolean
}

export type CreateOrderRecord = {
  publicNumber: string
  accessTokenHash: string
  idempotencyKey: string
  customerId: string | null
  customer: OrderCustomer
  pickupLocation: PickupLocation
  comment: string | null
  itemCount: number
  totalKopecks: number
  items: Array<{
    variantId: string
    productName: string
    variantLabel: string
    imageUrl: string | null
    unitPriceKopecks: number
    quantity: number
    totalKopecks: number
    position: number
  }>
}

export type OrderRepository = {
  findVariants(ids: string[]): Promise<OrderableVariant[]>
  listPickupLocations(): Promise<PickupLocation[]>
  findPickupLocation(id: string): Promise<PickupLocation | null>
  findByIdempotencyKey(key: string): Promise<Order | null>
  findById(id: string): Promise<Order | null>
  create(input: CreateOrderRecord): Promise<Order>
  findByAccessTokenHash(hash: string): Promise<Order | null>
  listByCustomerId(customerId: string): Promise<Order[]>
  listAll(): Promise<Order[]>
  updateStatus(id: string, status: OrderStatus, paymentStatus?: PaymentStatus): Promise<Order | null>
}

export type OrderTokens = {
  publicNumber(): string
  accessToken(idempotencyKey: string, publicNumber: string): string
  hash(token: string): string
}

export type Clock = { now(): Date }
