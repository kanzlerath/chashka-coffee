import { jobOpeningListResponseSchema, jobOpeningResponseSchema, jobOpeningRestaurantListResponseSchema, operationSuccessResponseSchema, upsertJobOpeningRequestSchema, type JobOpening, type UpsertJobOpeningRequest } from '@chashka-coffee/contracts'
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
type JobRecord = { id: string; slug: string; title: string; department: string | null; location: string | null; employmentType: string | null; description: string | null; restaurantId: string | null; restaurant: { id: string; name: string; address: string } | null; isPublished: boolean; status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | null; publishAt: Date | null; position: number; createdAt: Date; updatedAt: Date }
const dto = (value: JobRecord): JobOpening => ({ id: value.id, slug: value.slug, title: value.title, department: value.department, location: value.location, employmentType: value.employmentType, description: value.description, restaurant: value.restaurant, status: value.status ?? (value.isPublished ? 'PUBLISHED' : 'DRAFT'), publishAt: value.publishAt?.toISOString() ?? null, position: value.position, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() })
const data = (input: UpsertJobOpeningRequest) => ({ ...input, isPublished: input.status === 'PUBLISHED', publishAt: input.publishAt ? new Date(input.publishAt) : null })

export function createJobsModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('/jobs', requireAuth, requireAdmin)
  adminRoutes.use('/jobs/*', requireAuth, requireAdmin)
  const publicList = createRoute({ method: 'get', path: '/', responses: { 200: { content: { 'application/json': { schema: jobOpeningListResponseSchema } }, description: 'Published openings' } } })
  const publicDetail = createRoute({ method: 'get', path: '/{slug}', request: { params: slugParams }, responses: { 200: { content: { 'application/json': { schema: jobOpeningResponseSchema } }, description: 'Published opening' }, 404: { content: errorContent, description: 'Opening not found' } } })
  const adminList = createRoute({ method: 'get', path: '/jobs', responses: { 200: { content: { 'application/json': { schema: jobOpeningListResponseSchema } }, description: 'All openings' } } })
  const adminRestaurants = createRoute({ method: 'get', path: '/jobs/restaurants', responses: { 200: { content: { 'application/json': { schema: jobOpeningRestaurantListResponseSchema } }, description: 'Restaurants available for job openings' } } })
  const create = createRoute({ method: 'post', path: '/jobs', request: { body: { content: { 'application/json': { schema: upsertJobOpeningRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: jobOpeningResponseSchema } }, description: 'Opening created' } } })
  const update = createRoute({ method: 'put', path: '/jobs/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertJobOpeningRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: jobOpeningResponseSchema } }, description: 'Opening updated' }, 404: { content: errorContent, description: 'Opening not found' } } })
  const remove = createRoute({ method: 'delete', path: '/jobs/{id}', request: { params: idParams }, responses: { 200: { content: { 'application/json': { schema: operationSuccessResponseSchema } }, description: 'Opening deleted' }, 404: { content: errorContent, description: 'Opening not found' } } })
  const withRestaurant = { restaurant: { select: { id: true, name: true, address: true } } } as const
  const ensureRestaurantExists = async (restaurantId: string | null) => {
    if (!restaurantId) return
    const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } })
    if (!restaurant) throw new AppError(400, 'VALIDATION_ERROR', 'Restaurant not found')
  }
  routes.openapi(publicList, async (c) => { const now = new Date(); return c.json({ openings: (await db.jobOpening.findMany({ where: { OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', publishAt: { lte: now } }, { status: null, isPublished: true }] }, include: withRestaurant, orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] })).map(dto) }, 200) })
  routes.openapi(publicDetail, async (c) => { const now = new Date(); const opening = await db.jobOpening.findFirst({ where: { slug: c.req.valid('param').slug, OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', publishAt: { lte: now } }, { status: null, isPublished: true }] }, include: withRestaurant }); if (!opening) throw new AppError(404, 'NOT_FOUND', 'Job opening not found'); return c.json({ opening: dto(opening) }, 200) })
  adminRoutes.openapi(adminList, async (c) => c.json({ openings: (await db.jobOpening.findMany({ include: withRestaurant, orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] })).map(dto) }, 200))
  adminRoutes.openapi(adminRestaurants, async (c) => c.json({ restaurants: await db.restaurant.findMany({ select: { id: true, name: true, address: true }, orderBy: [{ name: 'asc' }, { address: 'asc' }] }) }, 200))
  adminRoutes.openapi(create, async (c) => { const input = c.req.valid('json'); await ensureRestaurantExists(input.restaurantId); return c.json({ opening: dto(await db.jobOpening.create({ data: data(input), include: withRestaurant })) }, 201) })
  adminRoutes.openapi(update, async (c) => { const input = c.req.valid('json'); await ensureRestaurantExists(input.restaurantId); const opening = await db.jobOpening.update({ where: { id: c.req.valid('param').id }, data: data(input), include: withRestaurant }); return c.json({ opening: dto(opening) }, 200) })
  adminRoutes.openapi(remove, async (c) => { const deleted = await db.jobOpening.deleteMany({ where: { id: c.req.valid('param').id } }); if (deleted.count === 0) throw new AppError(404, 'NOT_FOUND', 'Job opening not found'); return c.json({ success: true as const }, 200) })
  return { routes, adminRoutes }
}
