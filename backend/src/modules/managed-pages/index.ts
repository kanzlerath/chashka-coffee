import {
  contentBlockListSchema,
  managedPageKeySchema,
  managedPageListResponseSchema,
  managedPageResponseSchema,
  upsertManagedPageRequestSchema,
  type ManagedPage,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { DbClient } from '../../db'
import { AppError, validationErrorHook } from '../../http/errors'
import type { AuthHttpEnv } from '../auth'

type PageRecord = { id: string; key: ManagedPage['key']; title: string; blocks: unknown; createdAt: Date; updatedAt: Date }
function dto(page: PageRecord): ManagedPage {
  return { ...page, blocks: contentBlockListSchema.parse(page.blocks), createdAt: page.createdAt.toISOString(), updatedAt: page.updatedAt.toISOString() }
}

export function createManagedPagesModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('*', requireAuth, requireAdmin)

  const keyParams = z.object({ key: managedPageKeySchema })
  const publicDetail = createRoute({ method: 'get', path: '/{key}', request: { params: keyParams }, responses: { 200: { content: { 'application/json': { schema: managedPageResponseSchema } }, description: 'Managed page' }, 404: { description: 'Managed page not found' } } })
  const list = createRoute({ method: 'get', path: '/pages', responses: { 200: { content: { 'application/json': { schema: managedPageListResponseSchema } }, description: 'Managed pages' } } })
  const upsert = createRoute({ method: 'put', path: '/pages/{key}', request: { params: keyParams, body: { content: { 'application/json': { schema: upsertManagedPageRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: managedPageResponseSchema } }, description: 'Managed page saved' } } })

  routes.openapi(publicDetail, async (c) => {
    const page = await db.managedPage.findUnique({ where: { key: c.req.valid('param').key } })
    if (!page) throw new AppError(404, 'NOT_FOUND', 'Managed page not found')
    return c.json({ page: dto(page as PageRecord) }, 200)
  })
  adminRoutes.openapi(list, async (c) => {
    const pages = await db.managedPage.findMany({ orderBy: { key: 'asc' } })
    return c.json({ pages: pages.map((page) => dto(page as PageRecord)) }, 200)
  })
  adminRoutes.openapi(upsert, async (c) => {
    const key = c.req.valid('param').key
    const input = c.req.valid('json')
    if (input.key !== key) throw new AppError(400, 'VALIDATION_ERROR', 'Page key must match route key')
    const page = await db.managedPage.upsert({ where: { key }, create: input, update: { title: input.title, blocks: input.blocks } })
    return c.json({ page: dto(page as PageRecord) }, 200)
  })

  return { routes, adminRoutes }
}
