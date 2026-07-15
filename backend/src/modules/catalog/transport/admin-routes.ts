import {
  adminRestaurantListResponseSchema,
  adminRestaurantResponseSchema,
  apiErrorSchema,
  upsertRestaurantRequestSchema,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import { AppError, validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import type { CatalogService } from '../application/catalog-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const idParams = z.object({ id: z.uuid() })

const listRoute = createRoute({
  method: 'get',
  path: '/restaurants',
  responses: { 200: { content: { 'application/json': { schema: adminRestaurantListResponseSchema } }, description: 'Restaurants for administration' } },
})

const createRouteDefinition = createRoute({
  method: 'post',
  path: '/restaurants',
  request: { body: { content: { 'application/json': { schema: upsertRestaurantRequestSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: adminRestaurantResponseSchema } }, description: 'Restaurant created' },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const updateRoute = createRoute({
  method: 'put',
  path: '/restaurants/{id}',
  request: { params: idParams, body: { content: { 'application/json': { schema: upsertRestaurantRequestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: adminRestaurantResponseSchema } }, description: 'Restaurant updated' },
    404: { content: errorContent, description: 'Restaurant not found' },
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/restaurants/{id}',
  request: { params: idParams },
  responses: { 204: { description: 'Restaurant deleted' }, 404: { content: errorContent, description: 'Restaurant not found' } },
})

export function createCatalogAdminRoutes({ service, requireAuth, requireAdmin }: { service: CatalogService; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth, requireAdmin)

  routes.openapi(listRoute, async (c) => c.json({ restaurants: await service.listAdminRestaurants() }, 200))
  routes.openapi(createRouteDefinition, async (c) => c.json({ restaurant: await service.createRestaurant(c.req.valid('json')) }, 201))
  routes.openapi(updateRoute, async (c) => {
    const restaurant = await service.updateRestaurant(c.req.valid('param').id, c.req.valid('json'))
    if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found')
    return c.json({ restaurant }, 200)
  })
  routes.openapi(deleteRoute, async (c) => {
    const deleted = await service.deleteRestaurant(c.req.valid('param').id)
    if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found')
    return c.body(null, 204)
  })
  return routes
}
