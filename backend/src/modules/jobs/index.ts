import { jobOpeningListResponseSchema, jobOpeningResponseSchema, upsertJobOpeningRequestSchema, type JobOpening } from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { DbClient } from '../../db'
import { AppError, validationErrorHook } from '../../http/errors'
import type { AuthHttpEnv } from '../auth'

const idParams = z.object({ id: z.uuid() })
const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) })
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })
const errorContent = { 'application/json': { schema: errorSchema } }
const dto = (value: { id: string; slug: string; title: string; department: string | null; location: string | null; employmentType: string | null; description: string | null; isPublished: boolean; position: number; createdAt: Date; updatedAt: Date }): JobOpening => ({ ...value, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() })

export function createJobsModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('*', requireAuth, requireAdmin)
  const publicList = createRoute({ method: 'get', path: '/', responses: { 200: { content: { 'application/json': { schema: jobOpeningListResponseSchema } }, description: 'Published openings' } } })
  const publicDetail = createRoute({ method: 'get', path: '/{slug}', request: { params: slugParams }, responses: { 200: { content: { 'application/json': { schema: jobOpeningResponseSchema } }, description: 'Published opening' }, 404: { content: errorContent, description: 'Opening not found' } } })
  const adminList = createRoute({ method: 'get', path: '/jobs', responses: { 200: { content: { 'application/json': { schema: jobOpeningListResponseSchema } }, description: 'All openings' } } })
  const create = createRoute({ method: 'post', path: '/jobs', request: { body: { content: { 'application/json': { schema: upsertJobOpeningRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: jobOpeningResponseSchema } }, description: 'Opening created' } } })
  const update = createRoute({ method: 'put', path: '/jobs/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertJobOpeningRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: jobOpeningResponseSchema } }, description: 'Opening updated' }, 404: { content: errorContent, description: 'Opening not found' } } })
  routes.openapi(publicList, async (c) => c.json({ openings: (await db.jobOpening.findMany({ where: { isPublished: true }, orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] })).map(dto) }, 200))
  routes.openapi(publicDetail, async (c) => { const opening = await db.jobOpening.findFirst({ where: { slug: c.req.valid('param').slug, isPublished: true } }); if (!opening) throw new AppError(404, 'NOT_FOUND', 'Job opening not found'); return c.json({ opening: dto(opening) }, 200) })
  adminRoutes.openapi(adminList, async (c) => c.json({ openings: (await db.jobOpening.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] })).map(dto) }, 200))
  adminRoutes.openapi(create, async (c) => c.json({ opening: dto(await db.jobOpening.create({ data: c.req.valid('json') })) }, 201))
  adminRoutes.openapi(update, async (c) => { try { const opening = await db.jobOpening.update({ where: { id: c.req.valid('param').id }, data: c.req.valid('json') }); return c.json({ opening: dto(opening) }, 200) } catch { throw new AppError(404, 'NOT_FOUND', 'Job opening not found') } })
  return { routes, adminRoutes }
}
