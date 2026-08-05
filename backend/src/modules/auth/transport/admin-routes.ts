import { apiErrorSchema, createStaffUserRequestSchema, staffUserDeleteResponseSchema, staffUserListResponseSchema, staffUserResponseSchema, updateStaffUserRequestSchema } from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import type { AuthService } from '../application/auth-service'
import { executeAuth } from './errors'
import type { AuthHttpEnv } from './middleware'

const errors = { 'application/json': { schema: apiErrorSchema } }
const listRoute = createRoute({ method: 'get', path: '/users', responses: { 200: { content: { 'application/json': { schema: staffUserListResponseSchema } }, description: 'Staff users' } } })
const createRouteDefinition = createRoute({
  method: 'post', path: '/users', request: { body: { content: { 'application/json': { schema: createStaffUserRequestSchema } } } },
  responses: { 201: { content: { 'application/json': { schema: staffUserResponseSchema } }, description: 'Staff user created' }, 400: { content: errors, description: 'Invalid request' }, 403: { content: errors, description: 'Administrator access required' }, 409: { content: errors, description: 'Email already exists' } },
})
const idParams = z.object({ id: z.uuid() })
const updateRouteDefinition = createRoute({
  method: 'put', path: '/users/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: updateStaffUserRequestSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: staffUserResponseSchema } }, description: 'Staff user updated' }, 400: { content: errors, description: 'Invalid request' }, 403: { content: errors, description: 'Administrator access required' }, 404: { content: errors, description: 'Staff user not found' }, 409: { content: errors, description: 'Update conflicts with account safety rules' } },
})
const deleteRouteDefinition = createRoute({
  method: 'delete', path: '/users/{id}', request: { params: idParams },
  responses: { 200: { content: { 'application/json': { schema: staffUserDeleteResponseSchema } }, description: 'Staff user deleted' }, 403: { content: errors, description: 'Administrator access required' }, 404: { content: errors, description: 'Staff user not found' }, 409: { content: errors, description: 'Deletion conflicts with account safety rules' } },
})

export function createAdminUserRoutes({ service, requireAuth, requireAdmin }: { service: AuthService; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('/users', requireAuth, requireAdmin)
  routes.use('/users/*', requireAuth, requireAdmin)
  routes.openapi(listRoute, async (c) => c.json({ users: await service.listUsers() }, 200))
  routes.openapi(createRouteDefinition, async (c) => c.json({ user: await executeAuth(() => service.createStaffUser(c.req.valid('json'))) }, 201))
  routes.openapi(updateRouteDefinition, async (c) => c.json({ user: await executeAuth(() => service.updateStaffUser(c.req.valid('param').id, c.req.valid('json'))) }, 200))
  routes.openapi(deleteRouteDefinition, async (c) => {
    await executeAuth(() => service.deleteStaffUser(c.var.user.id, c.req.valid('param').id))
    return c.json({ deleted: true as const }, 200)
  })
  return routes
}
