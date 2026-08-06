import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AppEnv } from '../../env'
import type { AuthHttpEnv } from '../auth'
import { OperationalNotificationService } from './application/service'
import { createPrismaTelegramRecipientRepository } from './infrastructure/recipient-repository'
import { createTelegramGateway } from './infrastructure/telegram-gateway'
import { createOperationalNotificationRoutes } from './transport/routes'

export function createOperationalNotificationsModule({
  db,
  env,
  requireAuth,
  requireAdmin,
}: {
  db: DbClient
  env: AppEnv
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireAdmin: MiddlewareHandler<AuthHttpEnv>
}) {
  const service = new OperationalNotificationService({
    repository: createPrismaTelegramRecipientRepository(db),
    gateway: env.TELEGRAM_BOT_TOKEN ? createTelegramGateway(env.TELEGRAM_BOT_TOKEN) : null,
    botUsername: env.TELEGRAM_BOT_USERNAME ?? null,
    now: () => new Date(),
  })
  return {
    service,
    adminRoutes: createOperationalNotificationRoutes({ service, requireAuth, requireAdmin }),
  }
}

export type OperationalNotifications = Pick<OperationalNotificationService, 'notifyLead' | 'notifyOrder'>
