import {
  createTelegramRecipientRequestSchema,
  deleteTelegramRecipientResponseSchema,
  telegramCandidatesResponseSchema,
  telegramRecipientResponseSchema,
  telegramSettingsResponseSchema,
  testTelegramRecipientResponseSchema,
  updateTelegramRecipientRequestSchema,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import { AppError, validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import { OperationalNotificationFailure, type OperationalNotificationService } from '../application/service'

const params = z.object({ id: z.uuid() })
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })
const errorContent = { 'application/json': { schema: errorSchema } }

export function createOperationalNotificationRoutes({
  service,
  requireAuth,
  requireAdmin,
}: {
  service: OperationalNotificationService
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireAdmin: MiddlewareHandler<AuthHttpEnv>
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('/telegram', requireAuth, requireAdmin)
  routes.use('/telegram/*', requireAuth, requireAdmin)

  const settings = createRoute({ method: 'get', path: '/telegram', responses: { 200: { content: { 'application/json': { schema: telegramSettingsResponseSchema } }, description: 'Telegram settings' } } })
  const candidates = createRoute({ method: 'get', path: '/telegram/candidates', responses: { 200: { content: { 'application/json': { schema: telegramCandidatesResponseSchema } }, description: 'Recent private bot chats' }, 503: { content: errorContent, description: 'Telegram is not configured' } } })
  const createRecipient = createRoute({ method: 'post', path: '/telegram/recipients', request: { body: { content: { 'application/json': { schema: createTelegramRecipientRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: telegramRecipientResponseSchema } }, description: 'Recipient created' }, 409: { content: errorContent, description: 'Chat already linked' } } })
  const updateRecipient = createRoute({ method: 'put', path: '/telegram/recipients/{id}', request: { params, body: { content: { 'application/json': { schema: updateTelegramRecipientRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: telegramRecipientResponseSchema } }, description: 'Recipient updated' }, 404: { content: errorContent, description: 'Recipient not found' } } })
  const removeRecipient = createRoute({ method: 'delete', path: '/telegram/recipients/{id}', request: { params }, responses: { 200: { content: { 'application/json': { schema: deleteTelegramRecipientResponseSchema } }, description: 'Recipient removed' }, 404: { content: errorContent, description: 'Recipient not found' } } })
  const testRecipient = createRoute({ method: 'post', path: '/telegram/recipients/{id}/test', request: { params }, responses: { 200: { content: { 'application/json': { schema: testTelegramRecipientResponseSchema } }, description: 'Test sent' }, 404: { content: errorContent, description: 'Recipient not found' }, 502: { content: errorContent, description: 'Telegram rejected message' }, 503: { content: errorContent, description: 'Telegram is not configured' } } })

  routes.openapi(settings, async (c) => c.json(await service.getSettings(), 200))
  routes.openapi(candidates, async (c) => c.json({ candidates: await execute(() => service.listCandidates()) }, 200))
  routes.openapi(createRecipient, async (c) => {
    return c.json({ recipient: await execute(() => service.createRecipient(c.req.valid('json'))) }, 201)
  })
  routes.openapi(updateRecipient, async (c) => c.json({ recipient: await execute(() => service.updateRecipient(c.req.valid('param').id, c.req.valid('json'))) }, 200))
  routes.openapi(removeRecipient, async (c) => { await execute(() => service.removeRecipient(c.req.valid('param').id)); return c.json({ deleted: true as const }, 200) })
  routes.openapi(testRecipient, async (c) => { await execute(() => service.sendTest(c.req.valid('param').id)); return c.json({ sent: true as const }, 200) })
  return routes
}

async function execute<T>(operation: () => Promise<T>) {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof OperationalNotificationFailure)) throw error
    if (error.reason === 'not_found') throw new AppError(404, 'NOT_FOUND', error.message)
    if (error.reason === 'duplicate') throw new AppError(409, 'CONFLICT', error.message)
    if (error.reason === 'not_configured') throw new AppError(503, 'INTERNAL_ERROR', error.message)
    throw new AppError(502, 'INTERNAL_ERROR', error.message)
  }
}
