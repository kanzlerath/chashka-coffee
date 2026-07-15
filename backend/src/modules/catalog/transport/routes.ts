import {
  restaurantListQuerySchema,
  restaurantListResponseSchema,
  restaurantMenuResponseSchema,
  restaurantDetailResponseSchema,
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
const detailRoute = createRoute({
  method: 'get',
  path: '/{slug}',
  request: { params: z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }) },
  responses: { 200: { content: { 'application/json': { schema: restaurantDetailResponseSchema } }, description: 'Restaurant details' } },
})

export function createCatalogRoutes(service: CatalogService) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  routes.openapi(listRoute, async (c) => c.json(await service.listRestaurants(c.req.valid('query'))))
  routes.openapi(menuRoute, async (c) => {
    const menu = await service.getRestaurantMenu(c.req.valid('param').slug)
    if (!menu) throw new AppError(404, 'NOT_FOUND', 'Restaurant menu not found')
    return c.json(menu)
  })
  routes.openapi(detailRoute, async (c) => {
    const restaurant = await service.getRestaurantDetail(c.req.valid('param').slug)
    if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found')
    return c.json({ restaurant })
  })
  return routes
}
