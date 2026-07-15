import {
  adminRestaurantListResponseSchema,
  adminRestaurantResponseSchema,
  adminMenuListResponseSchema,
  adminMenuResponseSchema,
  adminMenuDetailResponseSchema,
  createdIdResponseSchema,
  apiErrorSchema,
  upsertRestaurantRequestSchema,
  upsertMenuRequestSchema,
  upsertMenuCategoryRequestSchema,
  upsertMenuItemRequestSchema,
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
const listMenusRoute = createRoute({ method: 'get', path: '/menus', responses: { 200: { content: { 'application/json': { schema: adminMenuListResponseSchema } }, description: 'Menu sets' } } })
const createMenuRoute = createRoute({ method: 'post', path: '/menus', request: { body: { content: { 'application/json': { schema: upsertMenuRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: adminMenuResponseSchema } }, description: 'Menu created' } } })
const updateMenuRoute = createRoute({ method: 'put', path: '/menus/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertMenuRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: adminMenuResponseSchema } }, description: 'Menu updated' } } })
const menuDetailRoute = createRoute({ method: 'get', path: '/menus/{id}/detail', request: { params: idParams }, responses: { 200: { content: { 'application/json': { schema: adminMenuDetailResponseSchema } }, description: 'Menu editor detail' } } })
const categoryRoute = createRoute({ method: 'post', path: '/menus/{id}/categories', request: { params: idParams, body: { content: { 'application/json': { schema: upsertMenuCategoryRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: createdIdResponseSchema } }, description: 'Category created' } } })
const itemRoute = createRoute({ method: 'post', path: '/categories/{id}/items', request: { params: idParams, body: { content: { 'application/json': { schema: upsertMenuItemRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: createdIdResponseSchema } }, description: 'Item created' } } })
const updateItemRoute = createRoute({ method: 'put', path: '/items/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertMenuItemRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: createdIdResponseSchema } }, description: 'Item updated' }, 404: { content: errorContent, description: 'Item not found' } } })

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
  routes.openapi(listMenusRoute, async (c) => c.json({ menus: await service.listAdminMenus() }, 200))
  routes.openapi(createMenuRoute, async (c) => c.json({ menu: await service.createMenu(c.req.valid('json')) }, 201))
  routes.openapi(updateMenuRoute, async (c) => {
    const menu = await service.updateMenu(c.req.valid('param').id, c.req.valid('json'))
    if (!menu) throw new AppError(404, 'NOT_FOUND', 'Menu not found')
    return c.json({ menu }, 200)
  })
  routes.openapi(menuDetailRoute, async (c) => { const detail = await service.getAdminMenuDetail(c.req.valid('param').id); if (!detail) throw new AppError(404, 'NOT_FOUND', 'Menu not found'); return c.json(detail, 200) })
  routes.openapi(categoryRoute, async (c) => { const id = await service.createCategory(c.req.valid('param').id, c.req.valid('json')); if (!id) throw new AppError(404, 'NOT_FOUND', 'Menu not found'); return c.json({ id }, 201) })
  routes.openapi(itemRoute, async (c) => { const id = await service.createItem(c.req.valid('param').id, c.req.valid('json')); if (!id) throw new AppError(404, 'NOT_FOUND', 'Category not found'); return c.json({ id }, 201) })
  routes.openapi(updateItemRoute, async (c) => { const id = await service.updateItem(c.req.valid('param').id, c.req.valid('json')); if (!id) throw new AppError(404, 'NOT_FOUND', 'Menu item not found'); return c.json({ id }, 200) })
  return routes
}
