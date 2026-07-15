import type { DbClient } from '../../db'

import { CatalogService } from './application/catalog-service'
import { createPrismaCatalogRepository } from './infrastructure/catalog-repository'
import { createCatalogAdminRoutes } from './transport/admin-routes'
import { createCatalogRoutes } from './transport/routes'

export function createCatalogModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: Parameters<typeof createCatalogAdminRoutes>[0]['requireAuth']; requireAdmin: Parameters<typeof createCatalogAdminRoutes>[0]['requireAdmin'] }) {
  const service = new CatalogService(createPrismaCatalogRepository(db))
  return { routes: createCatalogRoutes(service), adminRoutes: createCatalogAdminRoutes({ service, requireAuth, requireAdmin }) }
}
