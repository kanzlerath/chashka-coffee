import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { CrmRepository } from './infrastructure/crm-repository'
import { createCrmRoutes } from './transport/routes'

export function createCrmModule({
  db,
  requireAuth,
  requireCustomerRead,
}: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireCustomerRead: MiddlewareHandler<AuthHttpEnv>
}) {
  return createCrmRoutes({ repository: new CrmRepository(db), requireAuth, requireCustomerRead })
}
