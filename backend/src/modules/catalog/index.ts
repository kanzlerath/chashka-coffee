import type { DbClient } from '../../db'

import { CatalogService } from './application/catalog-service'
import { createPrismaCatalogRepository } from './infrastructure/catalog-repository'
import { createCatalogRoutes } from './transport/routes'

export function createCatalogModule({ db }: { db: DbClient }) {
  const service = new CatalogService(createPrismaCatalogRepository(db))
  return { routes: createCatalogRoutes(service) }
}
