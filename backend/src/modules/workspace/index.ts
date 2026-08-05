import {
  adminActivityResponseSchema,
  adminBulkUpdateRequestSchema,
  adminBulkUpdateResponseSchema,
  adminSearchResponseSchema,
  adminWorkspaceResponseSchema,
  type AuditEvent,
} from '@chashka-coffee/contracts'
import { hasPermission, type StaffPermission } from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { DbClient } from '../../db'
import { AppError, validationErrorHook } from '../../http/errors'
import type { AuthHttpEnv } from '../auth'

const searchQuerySchema = z.object({ q: z.string().trim().min(2).max(120) })
const activityQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) })

const contentHref = {
  PROMOTION: '/content/promotions',
  EVENT: '/content/events',
  ARTICLE: '/content/journal',
} as const

function auditDto(event: {
  id: string
  actorId: string | null
  actorName: string
  action: string
  resource: string
  resourceId: string | null
  path: string
  createdAt: Date
}): AuditEvent {
  return {
    ...event,
    action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'BULK_UPDATE']).parse(event.action),
    createdAt: event.createdAt.toISOString(),
  }
}

export function classifyAdminMutation(method: string, rawPath: string) {
  const path = rawPath.split('?')[0]
  if (!path.startsWith('/api/admin/') || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return null
  const segments = path.split('/').filter(Boolean)
  const resource = segments[2] ?? 'admin'
  const possibleId = segments.find((segment, index) => index > 2 && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment)) ?? null
  const action = path === '/api/admin/workspace/bulk-status'
    ? 'BULK_UPDATE'
    : method === 'POST'
      ? 'CREATE'
      : method === 'DELETE'
        ? 'DELETE'
        : 'UPDATE'
  return { action, resource, resourceId: possibleId } as const
}

export function createWorkspaceModule({
  db,
  requireAuth,
}: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
}) {
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('/workspace', requireAuth)
  adminRoutes.use('/workspace/*', requireAuth)

  const overviewRoute = createRoute({
    method: 'get',
    path: '/workspace',
    responses: { 200: { content: { 'application/json': { schema: adminWorkspaceResponseSchema } }, description: 'Action queues and recent admin activity' } },
  })
  const searchRoute = createRoute({
    method: 'get',
    path: '/workspace/search',
    request: { query: searchQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: adminSearchResponseSchema } }, description: 'Search across managed entities' } },
  })
  const activityRoute = createRoute({
    method: 'get',
    path: '/workspace/activity',
    request: { query: activityQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: adminActivityResponseSchema } }, description: 'Admin mutation history' } },
  })
  const bulkUpdateRoute = createRoute({
    method: 'post',
    path: '/workspace/bulk-status',
    request: { body: { content: { 'application/json': { schema: adminBulkUpdateRequestSchema } } } },
    responses: { 200: { content: { 'application/json': { schema: adminBulkUpdateResponseSchema } }, description: 'Bulk status update result' } },
  })

  adminRoutes.openapi(overviewRoute, async (c) => {
    assertPermission(c.var.user, 'AUDIT_READ')
    const now = new Date()
    const [newLeads, draftContent, expiredContent, draftProducts, draftJobs, pendingMedia, recentActivity] = await Promise.all([
      db.lead.count({ where: { status: 'NEW' } }),
      db.contentEntry.count({ where: { type: 'PROMOTION', status: 'DRAFT' } }),
      db.contentEntry.count({ where: { type: 'PROMOTION', status: 'PUBLISHED', endsAt: { lt: now } } }),
      db.product.count({ where: { type: 'COFFEE', status: 'DRAFT' } }),
      db.jobOpening.count({ where: { OR: [{ status: 'DRAFT' }, { status: null, isPublished: false }] } }),
      db.mediaAsset.count({ where: { status: 'PENDING' } }),
      db.adminAuditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ])
    return c.json({
      queues: [
        { key: 'NEW_LEADS' as const, label: 'Новые заявки', count: newLeads, href: '/leads?status=NEW', tone: newLeads > 0 ? 'URGENT' as const : 'NEUTRAL' as const },
        { key: 'DRAFT_CONTENT' as const, label: 'Акции в черновиках', count: draftContent, href: '/content/promotions?status=DRAFT', tone: draftContent > 0 ? 'ATTENTION' as const : 'NEUTRAL' as const },
        { key: 'EXPIRED_CONTENT' as const, label: 'Завершившиеся акции', count: expiredContent, href: '/content/promotions?expired=1', tone: expiredContent > 0 ? 'ATTENTION' as const : 'NEUTRAL' as const },
        { key: 'DRAFT_PRODUCTS' as const, label: 'Кофе в черновиках', count: draftProducts, href: '/products/coffee?status=DRAFT', tone: 'NEUTRAL' as const },
        { key: 'DRAFT_JOBS' as const, label: 'Вакансии в черновиках', count: draftJobs, href: '/jobs?status=DRAFT', tone: 'NEUTRAL' as const },
        { key: 'PENDING_MEDIA' as const, label: 'Файлы ожидают обработки', count: pendingMedia, href: '/media?status=PENDING', tone: pendingMedia > 0 ? 'ATTENTION' as const : 'NEUTRAL' as const },
      ],
      recentActivity: recentActivity.map(auditDto),
    }, 200)
  })

  adminRoutes.openapi(searchRoute, async (c) => {
    assertPermission(c.var.user, 'AUDIT_READ')
    const q = c.req.valid('query').q
    const contains = { contains: q, mode: 'insensitive' as const }
    const [restaurants, menus, leads, content, products, jobs] = await Promise.all([
      db.restaurant.findMany({ where: { OR: [{ name: contains }, { address: contains }, { city: contains }] }, orderBy: { updatedAt: 'desc' }, take: 6 }),
      db.menu.findMany({ where: { OR: [{ name: contains }, { description: contains }] }, orderBy: { updatedAt: 'desc' }, take: 6 }),
      db.lead.findMany({ where: { OR: [{ name: contains }, { phone: contains }, { email: contains }] }, orderBy: { updatedAt: 'desc' }, take: 6 }),
      db.contentEntry.findMany({ where: { OR: [{ title: contains }, { excerpt: contains }] }, orderBy: { updatedAt: 'desc' }, take: 8 }),
      db.product.findMany({ where: { OR: [{ name: contains }, { subtitle: contains }] }, orderBy: { updatedAt: 'desc' }, take: 8 }),
      db.jobOpening.findMany({ where: { OR: [{ title: contains }, { department: contains }, { location: contains }] }, orderBy: { updatedAt: 'desc' }, take: 6 }),
    ])
    const results = [
      ...restaurants.map((item) => ({ id: item.id, resource: 'RESTAURANT' as const, title: item.name, subtitle: `${item.city} · ${item.address}`, href: `/restaurants/${item.id}`, status: null, updatedAt: item.updatedAt.toISOString() })),
      ...menus.map((item) => ({ id: item.id, resource: 'MENU' as const, title: item.name, subtitle: item.description, href: `/menus/${item.id}`, status: null, updatedAt: item.updatedAt.toISOString() })),
      ...leads.map((item) => ({ id: item.id, resource: 'LEAD' as const, title: item.name, subtitle: item.phone ?? item.email, href: `/leads?lead=${item.id}`, status: item.status, updatedAt: item.updatedAt.toISOString() })),
      ...content.map((item) => ({ id: item.id, resource: 'CONTENT' as const, title: item.title, subtitle: item.excerpt, href: `${contentHref[item.type]}/${item.id}`, status: item.status, updatedAt: item.updatedAt.toISOString() })),
      ...products.map((item) => ({ id: item.id, resource: 'PRODUCT' as const, title: item.name, subtitle: item.subtitle, href: `/products/${item.type === 'COFFEE' ? 'coffee' : 'cakes'}/${item.id}`, status: item.status, updatedAt: item.updatedAt.toISOString() })),
      ...jobs.map((item) => ({ id: item.id, resource: 'JOB' as const, title: item.title, subtitle: [item.department, item.location].filter(Boolean).join(' · ') || null, href: `/jobs/${item.id}`, status: item.status ?? (item.isPublished ? 'PUBLISHED' : 'DRAFT'), updatedAt: item.updatedAt.toISOString() })),
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 40)
    return c.json({ results }, 200)
  })

  adminRoutes.openapi(activityRoute, async (c) => {
    assertPermission(c.var.user, 'AUDIT_READ')
    const events = await db.adminAuditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: c.req.valid('query').limit })
    return c.json({ events: events.map(auditDto) }, 200)
  })

  adminRoutes.openapi(bulkUpdateRoute, async (c) => {
    const input = c.req.valid('json')
    if (input.resource === 'LEAD') {
      const managesLeads = hasPermission(c.var.user, 'LEADS_MANAGE')
      const managesApplications = hasPermission(c.var.user, 'JOB_APPLICATIONS_MANAGE')
      if (!managesLeads && !managesApplications) throw new AppError(403, 'FORBIDDEN', 'Lead access is required')
      const allowedTypes = [
        ...(managesLeads ? ['CONTACT', 'RESERVATION', 'FRANCHISE', 'BANQUET', 'EVENT_REGISTRATION'] as const : []),
        ...(managesApplications ? ['JOB'] as const : []),
      ]
      const result = await db.lead.updateMany({ where: { id: { in: input.ids }, type: { in: allowedTypes } }, data: { status: input.status } })
      return c.json({ updated: result.count }, 200)
    }
    if (input.resource === 'CONTENT') {
      assertPermission(c.var.user, 'CONTENT_MANAGE')
      const result = await db.contentEntry.updateMany({ where: { id: { in: input.ids } }, data: { status: input.status } })
      return c.json({ updated: result.count }, 200)
    }
    if (input.resource === 'PRODUCT') {
      assertPermission(c.var.user, 'CATALOG_MANAGE')
      const result = await db.product.updateMany({ where: { id: { in: input.ids } }, data: { status: input.status } })
      return c.json({ updated: result.count }, 200)
    }
    assertPermission(c.var.user, 'JOBS_MANAGE')
    const result = await db.jobOpening.updateMany({ where: { id: { in: input.ids } }, data: { status: input.status, isPublished: input.status === 'PUBLISHED', publishAt: null } })
    return c.json({ updated: result.count }, 200)
  })

  const auditMiddleware: MiddlewareHandler<AuthHttpEnv> = async (c, next) => {
    const classification = classifyAdminMutation(c.req.method, c.req.path)
    await next()
    if (!classification || c.res.status >= 400) return
    const actor = c.var.user
    try {
      await db.adminAuditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.displayName?.trim() || actor.email,
          action: classification.action,
          resource: classification.resource,
          resourceId: classification.resourceId,
          path: c.req.path,
        },
      })
    } catch (error) {
      console.error('Failed to record admin audit event', error)
    }
  }

  return { adminRoutes, auditMiddleware }
}

function assertPermission(user: AuthHttpEnv['Variables']['user'], permission: StaffPermission) {
  if (!hasPermission(user, permission)) throw new AppError(403, 'FORBIDDEN', 'Your account does not have permission for this action')
}
