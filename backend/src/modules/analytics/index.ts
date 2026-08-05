import {
  analyticsPageViewRequestSchema,
  analyticsPageViewResponseSchema,
  analyticsSummaryResponseSchema,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { DbClient } from '../../db'
import { validationErrorHook } from '../../http/errors'
import type { AuthHttpEnv } from '../auth'

const periodQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
})

export function createAnalyticsModule({
  db,
  requireAuth,
  requireAdmin,
}: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireAdmin: MiddlewareHandler<AuthHttpEnv>
}) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('/analytics', requireAuth, requireAdmin)

  const record = createRoute({
    method: 'post',
    path: '/page-view',
    request: { body: { content: { 'application/json': { schema: analyticsPageViewRequestSchema } } } },
    responses: { 201: { content: { 'application/json': { schema: analyticsPageViewResponseSchema } }, description: 'Anonymous page view recorded' } },
  })
  const summary = createRoute({
    method: 'get',
    path: '/analytics',
    request: { query: periodQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: analyticsSummaryResponseSchema } }, description: 'Website analytics summary' } },
  })

  routes.openapi(record, async (c) => {
    const input = c.req.valid('json')
    await db.pageView.create({ data: input })
    return c.json({ recorded: true as const }, 201)
  })

  adminRoutes.openapi(summary, async (c) => {
    const periodDays = c.req.valid('query').days
    const now = new Date()
    const since = startOfUtcDay(new Date(now.getTime() - (periodDays - 1) * 86_400_000))
    const today = startOfUtcDay(now)
    const views = await db.pageView.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, path: true, visitorId: true, referrer: true, device: true, createdAt: true },
    })

    const dailyMap = new Map<string, { views: number; visitors: Set<string> }>()
    for (let offset = 0; offset < periodDays; offset += 1) {
      const date = new Date(since.getTime() + offset * 86_400_000).toISOString().slice(0, 10)
      dailyMap.set(date, { views: 0, visitors: new Set() })
    }
    const pageMap = new Map<string, { views: number; visitors: Set<string> }>()
    for (const view of views) {
      const day = view.createdAt.toISOString().slice(0, 10)
      const daily = dailyMap.get(day)
      if (daily) {
        daily.views += 1
        daily.visitors.add(view.visitorId)
      }
      const page = pageMap.get(view.path) ?? { views: 0, visitors: new Set<string>() }
      page.views += 1
      page.visitors.add(view.visitorId)
      pageMap.set(view.path, page)
    }

    const newLeads = await db.lead.count({ where: { status: 'NEW' } })
    return c.json({
      periodDays,
      overview: {
        views: views.length,
        visitors: new Set(views.map((view) => view.visitorId)).size,
        todayViews: views.filter((view) => view.createdAt >= today).length,
        newLeads,
      },
      daily: [...dailyMap].map(([date, value]) => ({ date, views: value.views, visitors: value.visitors.size })),
      topPages: [...pageMap]
        .map(([path, value]) => ({ path, views: value.views, visitors: value.visitors.size }))
        .sort((left, right) => right.views - left.views)
        .slice(0, 10),
      recent: views.slice(0, 30).map((view) => ({ ...view, createdAt: view.createdAt.toISOString() })),
    }, 200)
  })

  return { routes, adminRoutes }
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
