import {
  appChoiceSchema,
  coffeeTasteSchema,
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
import { Prisma } from '../../generated/prisma/client'
import { AppError, validationErrorHook } from '../../http/errors'
import type { AuthHttpEnv } from '../auth'

type PageRecord = {
  id: string
  key: ManagedPage['key']
  title: string
  heroTitle: string | null
  heroDescription: string | null
  heroImageUrl: string | null
  coffeeTastes: unknown | null
  appChoices: unknown | null
  blocks: unknown
  createdAt: Date
  updatedAt: Date
}
function dto(page: PageRecord): ManagedPage {
  return {
    ...page,
    coffeeTastes: page.coffeeTastes === null ? null : coffeeTasteSchema.array().parse(page.coffeeTastes),
    appChoices: page.appChoices === null ? null : appChoiceSchema.array().parse(page.appChoices),
    blocks: contentBlockListSchema.parse(page.blocks),
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  }
}

export function createManagedPagesModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('/pages', requireAuth, requireAdmin)
  adminRoutes.use('/pages/*', requireAuth, requireAdmin)

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
    const coffeeTastes = input.coffeeTastes === undefined ? undefined : input.coffeeTastes ?? Prisma.DbNull
    const appChoices = input.appChoices === undefined ? undefined : input.appChoices ?? Prisma.DbNull
    const page = await db.managedPage.upsert({
      where: { key },
      create: { ...input, coffeeTastes, appChoices },
      update: {
        title: input.title,
        heroTitle: input.heroTitle,
        heroDescription: input.heroDescription,
        heroImageUrl: input.heroImageUrl,
        coffeeTastes,
        appChoices,
        blocks: input.blocks,
      },
    })
    return c.json({ page: dto(page as PageRecord) }, 200)
  })

  return { routes, adminRoutes }
}
