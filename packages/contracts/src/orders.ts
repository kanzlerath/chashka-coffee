import { z } from 'zod'

import { customerPhoneSchema } from './customer-account'

const uuidSchema = z.uuid()
const publicUrlSchema = z.string().trim().min(1).max(2_048).refine(
  (value) => value.startsWith('/') || /^https?:\/\//.test(value),
  'Expected an absolute URL or a site-relative path',
)

export const orderStatusSchema = z.enum([
  'AWAITING_PAYMENT',
  'PAID',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'CANCELLED',
])
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const paymentStatusSchema = z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED'])
export type PaymentStatus = z.infer<typeof paymentStatusSchema>

export const orderLineInputSchema = z.object({
  variantId: uuidSchema,
  quantity: z.number().int().min(1).max(20),
}).strict()
export type OrderLineInput = z.infer<typeof orderLineInputSchema>

export const orderQuoteRequestSchema = z.object({
  lines: z.array(orderLineInputSchema).min(1).max(50),
}).strict()
export type OrderQuoteRequest = z.infer<typeof orderQuoteRequestSchema>

export const orderQuoteItemSchema = z.object({
  productId: uuidSchema,
  productSlug: z.string().trim().min(1).max(120),
  productName: z.string().trim().min(1).max(180),
  variantId: uuidSchema,
  variantLabel: z.string().trim().min(1).max(80),
  imageUrl: publicUrlSchema.nullable(),
  unitPriceKopecks: z.number().int().nonnegative(),
  quantity: z.number().int().min(1).max(20),
  totalKopecks: z.number().int().nonnegative(),
}).strict()
export type OrderQuoteItem = z.infer<typeof orderQuoteItemSchema>

export const unavailableOrderLineSchema = z.object({
  variantId: uuidSchema,
  reason: z.enum(['NOT_FOUND', 'NOT_AVAILABLE']),
}).strict()

export const orderQuoteResponseSchema = z.object({
  items: z.array(orderQuoteItemSchema),
  unavailableLines: z.array(unavailableOrderLineSchema),
  itemCount: z.number().int().nonnegative(),
  totalKopecks: z.number().int().nonnegative(),
}).strict()
export type OrderQuoteResponse = z.infer<typeof orderQuoteResponseSchema>

export const pickupLocationSchema = z.object({
  id: uuidSchema,
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  city: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(300),
  phone: z.string().trim().min(1).max(40),
  openingHoursLabel: z.string().trim().min(1).max(180),
}).strict()
export type PickupLocation = z.infer<typeof pickupLocationSchema>
export const pickupLocationListResponseSchema = z.object({ locations: z.array(pickupLocationSchema) }).strict()

export const orderCustomerSchema = z.object({
  name: z.string().trim().min(2).max(180),
  phone: customerPhoneSchema,
  email: z.email().max(320).nullable(),
}).strict()
export type OrderCustomer = z.infer<typeof orderCustomerSchema>

export const createOrderRequestSchema = z.object({
  lines: z.array(orderLineInputSchema).min(1).max(50),
  pickupRestaurantId: uuidSchema,
  customer: orderCustomerSchema,
  comment: z.string().trim().max(1_000).nullable(),
  privacyAccepted: z.literal(true),
  idempotencyKey: uuidSchema,
}).strict()
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

export const orderItemSchema = orderQuoteItemSchema.omit({ productId: true, productSlug: true, variantId: true }).extend({
  id: uuidSchema,
  variantId: uuidSchema.nullable(),
})
export type OrderItem = z.infer<typeof orderItemSchema>

export const orderSchema = z.object({
  id: uuidSchema,
  publicNumber: z.string().trim().min(6).max(32),
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  customer: orderCustomerSchema,
  pickupLocation: pickupLocationSchema.extend({ id: uuidSchema.nullable() }),
  items: z.array(orderItemSchema).min(1),
  itemCount: z.number().int().positive(),
  totalKopecks: z.number().int().nonnegative(),
  comment: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()
export type Order = z.infer<typeof orderSchema>

export const orderAccessTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
export const createOrderResponseSchema = z.object({
  order: orderSchema,
  accessToken: orderAccessTokenSchema,
}).strict()
export const orderResponseSchema = z.object({ order: orderSchema }).strict()
export const customerOrderListResponseSchema = z.object({ orders: z.array(orderSchema) }).strict()
export const adminOrderListResponseSchema = z.object({ orders: z.array(orderSchema) }).strict()

export const updateOrderStatusRequestSchema = z.object({ status: orderStatusSchema }).strict()
export type UpdateOrderStatusRequest = z.infer<typeof updateOrderStatusRequestSchema>
