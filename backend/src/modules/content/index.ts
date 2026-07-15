import {
  contentEntryListResponseSchema,
  contentEntryResponseSchema,
  contentEntryTypeSchema,
  upsertContentEntryRequestSchema,
  type ContentEntry,
  type UpsertContentEntryRequest,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { DbClient } from '../../db'
import { AppError, validationErrorHook } from '../../http/errors'
import type { AuthHttpEnv } from '../auth'

const idParams = z.object({ id: z.uuid() })
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })
const errorContent = { 'application/json': { schema: errorSchema } }

function dto(entry: { id: string; type: 'PROMOTION' | 'EVENT'; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; slug: string; title: string; excerpt: string | null; body: string | null; imageUrl: string | null; ctaLabel: string | null; ctaUrl: string | null; startsAt: Date | null; endsAt: Date | null; eventStartsAt: Date | null; location: string | null; isFeatured: boolean; position: number; createdAt: Date; updatedAt: Date }): ContentEntry {
  return { ...entry, startsAt: entry.startsAt?.toISOString() ?? null, endsAt: entry.endsAt?.toISOString() ?? null, eventStartsAt: entry.eventStartsAt?.toISOString() ?? null, createdAt: entry.createdAt.toISOString(), updatedAt: entry.updatedAt.toISOString() }
}

export function createContentModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('*', requireAuth, requireAdmin)
  const list = createRoute({ method: 'get', path: '/content', request: { query: z.object({ type: contentEntryTypeSchema.optional() }) }, responses: { 200: { content: { 'application/json': { schema: contentEntryListResponseSchema } }, description: 'Content entries' } } })
  const create = createRoute({ method: 'post', path: '/content', request: { body: { content: { 'application/json': { schema: upsertContentEntryRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: contentEntryResponseSchema } }, description: 'Content entry created' } } })
  const update = createRoute({ method: 'put', path: '/content/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertContentEntryRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: contentEntryResponseSchema } }, description: 'Content entry updated' }, 404: { content: errorContent, description: 'Content entry not found' } } })
  const publicList = createRoute({ method: 'get', path: '/', request: { query: z.object({ type: contentEntryTypeSchema }) }, responses: { 200: { content: { 'application/json': { schema: contentEntryListResponseSchema } }, description: 'Published content entries' } } })

  routes.openapi(publicList, async (c) => {
    const now = new Date()
    const entries = await db.contentEntry.findMany({ where: { type: c.req.valid('query').type, status: 'PUBLISHED', AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, orderBy: [{ isFeatured: 'desc' }, { position: 'asc' }, { eventStartsAt: 'asc' }] })
    return c.json({ entries: entries.map(dto) }, 200)
  })

  adminRoutes.openapi(list, async (c) => {
    const entries = await db.contentEntry.findMany({ where: c.req.valid('query').type ? { type: c.req.valid('query').type } : {}, orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] })
    return c.json({ entries: entries.map(dto) }, 200)
  })
  adminRoutes.openapi(create, async (c) => {
    const input = c.req.valid('json')
    const entry = await db.contentEntry.create({ data: dates(input) })
    return c.json({ entry: dto(entry) }, 201)
  })
  adminRoutes.openapi(update, async (c) => {
    try {
      const entry = await db.contentEntry.update({ where: { id: c.req.valid('param').id }, data: dates(c.req.valid('json')) })
      return c.json({ entry: dto(entry) }, 200)
    } catch {
      throw new AppError(404, 'NOT_FOUND', 'Content entry not found')
    }
  })
  return { routes, adminRoutes }
}

function dates(input: UpsertContentEntryRequest) {
  return { ...input, startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null, eventStartsAt: input.eventStartsAt ? new Date(input.eventStartsAt) : null }
}
