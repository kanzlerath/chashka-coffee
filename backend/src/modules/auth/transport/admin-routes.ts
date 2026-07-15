import { apiErrorSchema, createStaffUserRequestSchema, staffUserListResponseSchema, staffUserResponseSchema } from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import type { AuthService } from '../application/auth-service'
import type { AuthHttpEnv } from './middleware'

const errors = { 'application/json': { schema: apiErrorSchema } }
const listRoute = createRoute({ method: 'get', path: '/users', responses: { 200: { content: { 'application/json': { schema: staffUserListResponseSchema } }, description: 'Staff users' } } })
const createRouteDefinition = createRoute({
  method: 'post', path: '/users', request: { body: { content: { 'application/json': { schema: createStaffUserRequestSchema } } } },
  responses: { 201: { content: { 'application/json': { schema: staffUserResponseSchema } }, description: 'Staff user created' }, 400: { content: errors, description: 'Invalid request' }, 403: { content: errors, description: 'Administrator access required' }, 409: { content: errors, description: 'Email already exists' } },
})

export function createAdminUserRoutes({ service, requireAuth, requireAdmin }: { service: AuthService; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth, requireAdmin)
  routes.openapi(listRoute, async (c) => c.json({ users: await service.listUsers() }, 200))
  routes.openapi(createRouteDefinition, async (c) => c.json({ user: await service.createStaffUser(c.req.valid('json')) }, 201))
  return routes
}
