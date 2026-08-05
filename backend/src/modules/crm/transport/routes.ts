import {
  createCrmCustomerNoteRequestSchema,
  createCrmTagRequestSchema,
  crmAnalyticsResponseSchema,
  crmCustomerListQuerySchema,
  crmCustomerListResponseSchema,
  crmCustomerNoteResponseSchema,
  crmCustomerResponseSchema,
  crmTagListResponseSchema,
  crmTagResponseSchema,
  hasPermission,
  setCrmCustomerTagsRequestSchema,
  updateCrmCustomerRequestSchema,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import { AppError, validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import { CrmConflict } from '../domain/errors'
import type { CrmRepository } from '../infrastructure/crm-repository'

const idParams = z.object({ id: z.uuid() })
const noteParams = z.object({ id: z.uuid(), noteId: z.uuid() })
const deletedResponseSchema = z.object({ deleted: z.literal(true) }).strict()
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })
const errorContent = { 'application/json': { schema: errorSchema } }
const periodQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) })

export function createCrmRoutes({
  repository,
  requireAuth,
  requireCustomerRead,
}: {
  repository: CrmRepository
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireCustomerRead: MiddlewareHandler<AuthHttpEnv>
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('/customers', requireAuth, requireCustomerRead)
  routes.use('/customers/*', requireAuth, requireCustomerRead)
  routes.use('/customer-tags', requireAuth, requireCustomerRead)
  routes.use('/customer-tags/*', requireAuth, requireCustomerRead)
  routes.use('/crm-analytics', requireAuth, requireCustomerRead)

  const list = createRoute({
    method: 'get', path: '/customers', request: { query: crmCustomerListQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: crmCustomerListResponseSchema } }, description: 'CRM customers' } },
  })
  const detail = createRoute({
    method: 'get', path: '/customers/{id}', request: { params: idParams },
    responses: {
      200: { content: { 'application/json': { schema: crmCustomerResponseSchema } }, description: 'CRM customer' },
      404: { content: errorContent, description: 'Customer not found' },
    },
  })
  const update = createRoute({
    method: 'put', path: '/customers/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: updateCrmCustomerRequestSchema } } } },
    responses: {
      200: { content: { 'application/json': { schema: crmCustomerResponseSchema } }, description: 'CRM customer updated' },
      404: { content: errorContent, description: 'Customer not found' },
    },
  })
  const createNote = createRoute({
    method: 'post', path: '/customers/{id}/notes', request: { params: idParams, body: { content: { 'application/json': { schema: createCrmCustomerNoteRequestSchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: crmCustomerNoteResponseSchema } }, description: 'Customer note created' },
      404: { content: errorContent, description: 'Customer not found' },
    },
  })
  const deleteNote = createRoute({
    method: 'delete', path: '/customers/{id}/notes/{noteId}', request: { params: noteParams },
    responses: {
      200: { content: { 'application/json': { schema: deletedResponseSchema } }, description: 'Customer note deleted' },
      404: { content: errorContent, description: 'Note not found' },
    },
  })
  const setTags = createRoute({
    method: 'put', path: '/customers/{id}/tags', request: { params: idParams, body: { content: { 'application/json': { schema: setCrmCustomerTagsRequestSchema } } } },
    responses: {
      200: { content: { 'application/json': { schema: crmCustomerResponseSchema } }, description: 'Customer tags updated' },
      404: { content: errorContent, description: 'Customer or tag not found' },
    },
  })
  const listTags = createRoute({
    method: 'get', path: '/customer-tags',
    responses: { 200: { content: { 'application/json': { schema: crmTagListResponseSchema } }, description: 'CRM tags' } },
  })
  const createTag = createRoute({
    method: 'post', path: '/customer-tags', request: { body: { content: { 'application/json': { schema: createCrmTagRequestSchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: crmTagResponseSchema } }, description: 'CRM tag created' },
      409: { content: errorContent, description: 'Tag name already exists' },
    },
  })
  const deleteTag = createRoute({
    method: 'delete', path: '/customer-tags/{id}', request: { params: idParams },
    responses: {
      200: { content: { 'application/json': { schema: deletedResponseSchema } }, description: 'CRM tag deleted' },
      404: { content: errorContent, description: 'Tag not found' },
    },
  })
  const analytics = createRoute({
    method: 'get', path: '/crm-analytics', request: { query: periodQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: crmAnalyticsResponseSchema } }, description: 'Online coffee sales analytics' } },
  })

  routes.openapi(list, async (c) => c.json(await repository.listCustomers(c.req.valid('query')), 200))
  routes.openapi(detail, async (c) => c.json({ customer: await requiredCustomer(repository, c.req.valid('param').id) }, 200))
  routes.openapi(update, async (c) => {
    assertCustomerManage(c.var.user)
    const customer = await repository.updateCustomer(c.req.valid('param').id, c.req.valid('json'))
    if (!customer) throw new AppError(404, 'NOT_FOUND', 'Клиент не найден')
    return c.json({ customer }, 200)
  })
  routes.openapi(createNote, async (c) => {
    assertCustomerManage(c.var.user)
    const note = await repository.createNote(c.req.valid('param').id, c.var.user.id, c.req.valid('json').body)
    if (!note) throw new AppError(404, 'NOT_FOUND', 'Клиент не найден')
    return c.json({ note }, 201)
  })
  routes.openapi(deleteNote, async (c) => {
    assertCustomerManage(c.var.user)
    const { id, noteId } = c.req.valid('param')
    if (!await repository.deleteNote(id, noteId)) throw new AppError(404, 'NOT_FOUND', 'Заметка не найдена')
    return c.json({ deleted: true as const }, 200)
  })
  routes.openapi(setTags, async (c) => {
    assertCustomerManage(c.var.user)
    const id = c.req.valid('param').id
    const result = await repository.setCustomerTags(id, c.req.valid('json').tagIds)
    if (!result) throw new AppError(404, 'NOT_FOUND', 'Клиент не найден')
    if (result === 'INVALID_TAGS') throw new AppError(404, 'NOT_FOUND', 'Один из тегов не найден')
    return c.json({ customer: await requiredCustomer(repository, id) }, 200)
  })
  routes.openapi(listTags, async (c) => c.json({ tags: await repository.listTags() }, 200))
  routes.openapi(createTag, async (c) => {
    assertCustomerManage(c.var.user)
    try {
      const tag = await repository.createTag(c.req.valid('json').name, c.req.valid('json').color)
      return c.json({ tag }, 201)
    } catch (error) {
      if (error instanceof CrmConflict) throw new AppError(409, 'CONFLICT', 'Тег с таким названием уже существует')
      throw error
    }
  })
  routes.openapi(deleteTag, async (c) => {
    assertCustomerManage(c.var.user)
    if (!await repository.deleteTag(c.req.valid('param').id)) throw new AppError(404, 'NOT_FOUND', 'Тег не найден')
    return c.json({ deleted: true as const }, 200)
  })
  routes.openapi(analytics, async (c) => c.json(await repository.analytics(c.req.valid('query').days), 200))

  return routes
}

async function requiredCustomer(repository: CrmRepository, id: string) {
  const customer = await repository.getCustomer(id)
  if (!customer) throw new AppError(404, 'NOT_FOUND', 'Клиент не найден')
  return customer
}

function assertCustomerManage(user: AuthHttpEnv['Variables']['user']) {
  if (!hasPermission(user, 'CUSTOMERS_MANAGE')) throw new AppError(403, 'FORBIDDEN', 'Недостаточно прав для изменения CRM')
}
