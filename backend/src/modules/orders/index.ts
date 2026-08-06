import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AppEnv } from '../../env'
import type { AuthHttpEnv } from '../auth'
import type { OperationalNotifications } from '../operational-notifications'
import { OrderService } from './application/order-service'
import { createPrismaOrderRepository } from './infrastructure/order-repository'
import { createOrderAccessToken, createOrderPublicNumber, hashOrderAccessToken } from './infrastructure/order-tokens'
import { createOrderRoutes } from './transport/routes'

const systemClock = { now: () => new Date() }

export function createOrdersModule({
  db,
  env,
  requireAuth,
  requireOrderAccess,
  resolveCustomerId,
  notifications,
}: {
  db: DbClient
  env: AppEnv
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireOrderAccess: MiddlewareHandler<AuthHttpEnv>
  resolveCustomerId: (sessionToken: string | undefined) => Promise<string | null>
  notifications?: OperationalNotifications
}) {
  const service = new OrderService({
    clock: systemClock,
    repository: createPrismaOrderRepository(db),
    tokens: {
      publicNumber: createOrderPublicNumber,
      accessToken: createOrderAccessToken,
      hash: hashOrderAccessToken,
    },
    onCreated: (order) => notifications?.notifyOrder(order) ?? Promise.resolve(),
  })
  return createOrderRoutes({ env, service, requireAuth, requireOrderAccess, resolveCustomerId })
}
