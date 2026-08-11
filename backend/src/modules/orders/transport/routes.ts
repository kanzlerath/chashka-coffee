import {
  adminOrderListResponseSchema,
  createOrderRequestSchema,
  createOrderResponseSchema,
  customerOrderListResponseSchema,
  orderAccessTokenSchema,
  orderQuoteRequestSchema,
  orderQuoteResponseSchema,
  orderResponseSchema,
  pickupLocationListResponseSchema,
  startOrderPaymentResponseSchema,
  updateOrderStatusRequestSchema,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { z } from 'zod'

import type { AppEnv } from '../../../env'
import { AppError, validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import { customerSessionCookieName } from '../../customer-account'
import type { OrderService } from '../application/order-service'
import type { PaymentService } from '../application/payment-service'
import { OrderFailure } from '../domain/errors'
import { PaymentFailure } from '../domain/payment-errors'

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }) })
const errorContent = { 'application/json': { schema: errorSchema } }

export function createOrderRoutes({
  env,
  service,
  paymentService,
  requireAuth,
  requireOrderAccess,
  resolveCustomerId,
}: {
  env: AppEnv
  service: OrderService
  paymentService: PaymentService | null
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireOrderAccess: MiddlewareHandler<AuthHttpEnv>
  resolveCustomerId: (sessionToken: string | undefined) => Promise<string | null>
}) {
  const storeRoutes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const customerRoutes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  const paymentRoutes = new OpenAPIHono({ defaultHook: validationErrorHook })
  adminRoutes.use('/orders', requireAuth, requireOrderAccess)
  adminRoutes.use('/orders/*', requireAuth, requireOrderAccess)

  const pickupLocations = createRoute({
    method: 'get', path: '/pickup-locations',
    responses: { 200: { content: { 'application/json': { schema: pickupLocationListResponseSchema } }, description: 'Coffee pickup locations' } },
  })
  const quote = createRoute({
    method: 'post', path: '/quote',
    request: { body: { content: { 'application/json': { schema: orderQuoteRequestSchema } } } },
    responses: { 200: { content: { 'application/json': { schema: orderQuoteResponseSchema } }, description: 'Server-calculated cart' } },
  })
  const create = createRoute({
    method: 'post', path: '/orders',
    request: { body: { content: { 'application/json': { schema: createOrderRequestSchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: createOrderResponseSchema } }, description: 'Order created' },
      409: { content: errorContent, description: 'Cart or pickup location changed' },
    },
  })
  const publicOrder = createRoute({
    method: 'get', path: '/orders/{accessToken}',
    request: { params: z.object({ accessToken: orderAccessTokenSchema }) },
    responses: {
      200: { content: { 'application/json': { schema: orderResponseSchema } }, description: 'Order by private access token' },
      404: { content: errorContent, description: 'Order not found' },
    },
  })
  const startPayment = createRoute({
    method: 'post', path: '/orders/{accessToken}/payment',
    request: { params: z.object({ accessToken: orderAccessTokenSchema }) },
    responses: {
      200: { content: { 'application/json': { schema: startOrderPaymentResponseSchema } }, description: 'Reusable YooKassa redirect payment' },
      409: { content: errorContent, description: 'Order cannot be paid' },
      503: { content: errorContent, description: 'YooKassa is not configured' },
    },
  })
  const customerOrders = createRoute({
    method: 'get', path: '/orders',
    responses: {
      200: { content: { 'application/json': { schema: customerOrderListResponseSchema } }, description: 'Current customer orders' },
      401: { content: errorContent, description: 'Customer session required' },
    },
  })
  const customerOrder = createRoute({
    method: 'get', path: '/orders/{id}',
    request: { params: z.object({ id: z.uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: orderResponseSchema } }, description: 'Current customer order' },
      401: { content: errorContent, description: 'Customer session required' },
      404: { content: errorContent, description: 'Order not found for current customer' },
    },
  })
  const customerOrderPayment = createRoute({
    method: 'post', path: '/orders/{id}/payment',
    request: { params: z.object({ id: z.uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: startOrderPaymentResponseSchema } }, description: 'Reusable YooKassa redirect payment for current customer order' },
      401: { content: errorContent, description: 'Customer session required' },
      404: { content: errorContent, description: 'Order not found for current customer' },
      409: { content: errorContent, description: 'Order cannot be paid' },
      503: { content: errorContent, description: 'YooKassa is not configured' },
    },
  })
  const adminList = createRoute({
    method: 'get', path: '/orders',
    responses: { 200: { content: { 'application/json': { schema: adminOrderListResponseSchema } }, description: 'All coffee orders' } },
  })
  const adminUpdate = createRoute({
    method: 'put', path: '/orders/{id}/status',
    request: {
      params: z.object({ id: z.uuid() }),
      body: { content: { 'application/json': { schema: updateOrderStatusRequestSchema } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: orderResponseSchema } }, description: 'Order status updated' },
      404: { content: errorContent, description: 'Order not found' },
      409: { content: errorContent, description: 'Invalid status transition' },
    },
  })
  const webhookNotificationSchema = z.object({
    type: z.literal('notification'),
    event: z.enum(['payment.succeeded', 'payment.canceled']),
    object: z.object({ id: z.string().min(1) }).passthrough(),
  }).passthrough()
  const webhook = createRoute({
    method: 'post', path: '/webhook',
    request: { body: { content: { 'application/json': { schema: webhookNotificationSchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.literal(true) }) } }, description: 'Notification accepted' } },
  })

  storeRoutes.openapi(pickupLocations, async (c) => c.json({ locations: await service.listPickupLocations() }, 200))
  storeRoutes.openapi(quote, async (c) => c.json(await service.quote(c.req.valid('json').lines), 200))
  storeRoutes.openapi(create, async (c) => {
    assertTrustedOrigin(c, env)
    const customerId = await resolveCustomerId(getCookie(c, customerSessionCookieName))
    const response = await executeOrder(() => service.create(c.req.valid('json'), customerId))
    c.header('Cache-Control', 'no-store')
    return c.json(response, 201)
  })
  storeRoutes.openapi(publicOrder, async (c) => {
    const order = await executeOrder(() => service.getByAccessToken(c.req.valid('param').accessToken))
    c.header('Cache-Control', 'no-store')
    return c.json({ order }, 200)
  })
  storeRoutes.openapi(startPayment, async (c) => {
    assertTrustedOrigin(c, env)
    if (!paymentService) throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Оплата ЮKassa пока не настроена.')
    const response = await executePayment(() => paymentService.start(c.req.valid('param').accessToken))
    c.header('Cache-Control', 'no-store')
    return c.json(response, 200)
  })
  customerRoutes.openapi(customerOrders, async (c) => {
    const customerId = await requireCustomerId(c, resolveCustomerId)
    c.header('Cache-Control', 'no-store')
    return c.json({ orders: await service.listCustomerOrders(customerId) }, 200)
  })
  customerRoutes.openapi(customerOrder, async (c) => {
    const customerId = await requireCustomerId(c, resolveCustomerId)
    const order = await executeOrder(() => service.getCustomerOrder(customerId, c.req.valid('param').id))
    c.header('Cache-Control', 'no-store')
    return c.json({ order }, 200)
  })
  customerRoutes.openapi(customerOrderPayment, async (c) => {
    assertTrustedOrigin(c, env)
    const customerId = await requireCustomerId(c, resolveCustomerId)
    const order = await executeOrder(() => service.getCustomerOrder(customerId, c.req.valid('param').id))
    const response = await executePayment(() => requirePaymentService(paymentService).startCustomerOrder(order))
    c.header('Cache-Control', 'no-store')
    return c.json(response, 200)
  })
  adminRoutes.openapi(adminList, async (c) => c.json({ orders: await service.listAdminOrders() }, 200))
  adminRoutes.openapi(adminUpdate, async (c) => {
    const { id } = c.req.valid('param')
    const { status } = c.req.valid('json')
    const order = status === 'COMPLETED'
      ? await executePayment(() => requirePaymentService(paymentService).complete(id))
      : await executeOrder(() => service.updateStatus(id, status))
    return c.json({ order }, 200)
  })
  paymentRoutes.openapi(webhook, async (c) => {
    if (!paymentService) throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Оплата ЮKassa пока не настроена.')
    const notification = c.req.valid('json')
    await executePayment(() => paymentService.handleNotification({
      event: notification.event,
      paymentId: notification.object.id,
    }))
    return c.json({ ok: true as const }, 200)
  })

  return { storeRoutes, customerRoutes, adminRoutes, paymentRoutes }
}

function requirePaymentService(service: PaymentService | null) {
  if (!service) throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Оплата ЮKassa пока не настроена.')
  return service
}

async function requireCustomerId(c: Context, resolveCustomerId: (sessionToken: string | undefined) => Promise<string | null>) {
  const customerId = await resolveCustomerId(getCookie(c, customerSessionCookieName))
  if (!customerId) throw new AppError(401, 'UNAUTHORIZED', 'Войдите в аккаунт, чтобы увидеть заказы.')
  return customerId
}

async function executePayment<T>(operation: () => Promise<T>) {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof OrderFailure) return executeOrder(() => Promise.reject(error))
    if (!(error instanceof PaymentFailure)) throw error
    switch (error.code) {
      case 'payment_not_configured':
        throw new AppError(503, 'SERVICE_UNAVAILABLE', error.message)
      case 'payment_not_available':
      case 'payment_verification_failed':
        throw new AppError(502, 'UPSTREAM_ERROR', error.message, error.details)
      case 'payment_already_completed':
      case 'closing_receipt_required':
        throw new AppError(409, 'CONFLICT', error.message, error.details)
    }
  }
}

function assertTrustedOrigin(c: Context, env: AppEnv) {
  if (!env.COOKIE_SECURE) return
  const origin = c.req.header('origin')
  if (origin && env.CORS_ORIGINS.includes(origin)) return
  throw new AppError(403, 'FORBIDDEN', 'Order requests require a trusted Origin')
}

async function executeOrder<T>(operation: () => Promise<T>) {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof OrderFailure)) throw error
    switch (error.code) {
      case 'cart_unavailable':
      case 'pickup_unavailable':
      case 'invalid_status_transition':
        throw new AppError(409, 'CONFLICT', error.message, error.details)
      case 'order_not_found':
        throw new AppError(404, 'NOT_FOUND', error.message)
    }
  }
}
