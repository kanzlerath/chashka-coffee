import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AppEnv } from '../../env'
import type { AuthHttpEnv } from '../auth'
import type { OperationalNotifications } from '../operational-notifications'
import type { YooKassaGateway } from './application/payment-ports'
import { OrderService } from './application/order-service'
import { PaymentService } from './application/payment-service'
import { createPrismaOrderRepository } from './infrastructure/order-repository'
import { createPrismaOrderPaymentRepository } from './infrastructure/payment-repository'
import { createOrderAccessToken, createOrderPublicNumber, hashOrderAccessToken } from './infrastructure/order-tokens'
import { createYooKassaGateway } from './infrastructure/yookassa-client'
import { createOrderRoutes } from './transport/routes'

const systemClock = { now: () => new Date() }

export function createOrdersModule({
  db,
  env,
  requireAuth,
  requireOrderAccess,
  resolveCustomerId,
  notifications,
  yooKassaGateway,
}: {
  db: DbClient
  env: AppEnv
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireOrderAccess: MiddlewareHandler<AuthHttpEnv>
  resolveCustomerId: (sessionToken: string | undefined) => Promise<string | null>
  notifications?: OperationalNotifications
  yooKassaGateway?: YooKassaGateway
}) {
  const service = new OrderService({
    clock: systemClock,
    repository: createPrismaOrderRepository(db),
    tokens: {
      publicNumber: createOrderPublicNumber,
      accessToken: createOrderAccessToken,
      hash: hashOrderAccessToken,
    },
  })
  const paymentService = env.YOOKASSA_SHOP_ID && env.YOOKASSA_SECRET_KEY && env.YOOKASSA_RETURN_URL
    ? new PaymentService({
        orders: service,
        repository: createPrismaOrderPaymentRepository(db),
        gateway: yooKassaGateway ?? createYooKassaGateway({ shopId: env.YOOKASSA_SHOP_ID, secretKey: env.YOOKASSA_SECRET_KEY }),
        expectedTestMode: env.YOOKASSA_TEST_MODE ?? false,
        returnUrl: env.YOOKASSA_RETURN_URL,
        idempotencyKey: () => crypto.randomUUID(),
        onPaid: (order) => notifications?.notifyOrder(order) ?? Promise.resolve(),
      })
    : null
  return createOrderRoutes({ env, service, paymentService, requireAuth, requireOrderAccess, resolveCustomerId })
}

export type { YooKassaGateway } from './application/payment-ports'
