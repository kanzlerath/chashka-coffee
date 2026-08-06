import { siteHeaderPreviewSchema, siteSettingsResponseSchema, upsertSiteSettingsRequestSchema, type SiteSettings } from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import { validationErrorHook } from '../../http/errors'
import type { AuthHttpEnv } from '../auth'

type SettingsRecord = { headerPreviews: unknown; updatedAt: Date }
const dto = (value: SettingsRecord): SiteSettings => ({ headerPreviews: siteHeaderPreviewSchema.array().parse(value.headerPreviews), updatedAt: value.updatedAt.toISOString() })
const emptySettings = (): SiteSettings => ({ headerPreviews: [], updatedAt: new Date(0).toISOString() })

export function createSiteSettingsModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('/site-settings', requireAuth, requireAdmin)

  const read = createRoute({ method: 'get', path: '/', responses: { 200: { content: { 'application/json': { schema: siteSettingsResponseSchema } }, description: 'Shared site settings' } } })
  const adminRead = createRoute({ method: 'get', path: '/site-settings', responses: { 200: { content: { 'application/json': { schema: siteSettingsResponseSchema } }, description: 'Shared site settings' } } })
  const update = createRoute({ method: 'put', path: '/site-settings', request: { body: { content: { 'application/json': { schema: upsertSiteSettingsRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: siteSettingsResponseSchema } }, description: 'Shared site settings saved' } } })

  const find = async () => {
    const settings = await db.siteSettings.findUnique({ where: { id: 'global' } })
    return settings ? dto(settings as SettingsRecord) : emptySettings()
  }
  routes.openapi(read, async (c) => c.json({ settings: await find() }, 200))
  adminRoutes.openapi(adminRead, async (c) => c.json({ settings: await find() }, 200))
  adminRoutes.openapi(update, async (c) => {
    const input = c.req.valid('json')
    const settings = await db.siteSettings.upsert({ where: { id: 'global' }, create: { id: 'global', headerPreviews: input.headerPreviews }, update: { headerPreviews: input.headerPreviews } })
    return c.json({ settings: dto(settings as SettingsRecord) }, 200)
  })
  return { routes, adminRoutes }
}
