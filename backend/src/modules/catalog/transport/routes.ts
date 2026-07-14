import {
  restaurantListQuerySchema,
  restaurantListResponseSchema,
  restaurantMenuResponseSchema,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { AppError, validationErrorHook } from '../../../http/errors'
import type { CatalogService } from '../application/catalog-service'

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: restaurantListQuerySchema },
  responses: { 200: { content: { 'application/json': { schema: restaurantListResponseSchema } }, description: 'Restaurant directory' } },
})

const menuRoute = createRoute({
  method: 'get',
  path: '/{slug}/menu',
  request: { params: z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }) },
  responses: {
    200: { content: { 'application/json': { schema: restaurantMenuResponseSchema } }, description: 'Menu for a restaurant' },
  },
})

export function createCatalogRoutes(service: CatalogService) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  routes.openapi(listRoute, async (c) => c.json(await service.listRestaurants(c.req.valid('query'))))
  routes.openapi(menuRoute, async (c) => {
    const menu = await service.getRestaurantMenu(c.req.valid('param').slug)
    if (!menu) throw new AppError(404, 'NOT_FOUND', 'Restaurant menu not found')
    return c.json(menu)
  })
  return routes
}
