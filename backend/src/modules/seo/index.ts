import { seoPageListResponseSchema, seoPageResponseSchema, publicSeoResponseSchema, upsertSeoPageRequestSchema, type SeoPage } from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { DbClient } from '../../db'
import { validationErrorHook } from '../../http/errors'
import type { AuthHttpEnv } from '../auth'

const staticPages = [
  ['/', 'Главная'], ['/coffee', 'Кофе'], ['/restaurants', 'Рестораны'], ['/delivery', 'Доставка'], ['/app', 'Приложение'], ['/loyalty', 'Лояльность'], ['/certificates', 'Сертификаты'], ['/bakery', 'Десерты'], ['/franchise', 'Франшиза'], ['/jobs', 'Вакансии'], ['/contacts', 'Контакты'], ['/about', 'О компании'], ['/banquets', 'Банкеты'], ['/promotions', 'Акции'],
] as const

const dto = (value: { key: string; path: string; label: string; title: string | null; description: string | null; imageUrl: string | null; canonicalUrl: string | null; noindex: boolean; updatedAt: Date | null }): SeoPage => ({ ...value, updatedAt: value.updatedAt?.toISOString() ?? null })

export function createSeoModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('/seo', requireAuth, requireAdmin)
  adminRoutes.use('/seo/*', requireAuth, requireAdmin)

  const publicRead = createRoute({ method: 'get', path: '/', request: { query: z.object({ path: z.string().trim().startsWith('/').max(300) }) }, responses: { 200: { content: { 'application/json': { schema: publicSeoResponseSchema } }, description: 'SEO metadata for a public path' } } })
  const list = createRoute({ method: 'get', path: '/seo', responses: { 200: { content: { 'application/json': { schema: seoPageListResponseSchema } }, description: 'SEO metadata pages' } } })
  const upsert = createRoute({ method: 'put', path: '/seo/{key}', request: { params: z.object({ key: z.string().trim().min(1).max(160) }), body: { content: { 'application/json': { schema: upsertSeoPageRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: seoPageResponseSchema } }, description: 'SEO metadata saved' } } })

  routes.openapi(publicRead, async (c) => {
    const path = c.req.valid('query').path
    const record = await db.seoMetadata.findUnique({ where: { path } })
    if (record) return c.json({ page: dto(record) }, 200)
    const managed = staticPages.find(([candidate]) => candidate === path)
    if (!managed) return c.json({ page: null }, 200)
    const keyMap: Record<string, string> = { '/': 'HOME', '/coffee': 'COFFEE', '/restaurants': 'RESTAURANTS', '/delivery': 'DELIVERY', '/app': 'APP', '/loyalty': 'LOYALTY', '/certificates': 'CERTIFICATES', '/bakery': 'BAKERY', '/franchise': 'FRANCHISE', '/jobs': 'JOBS', '/contacts': 'CONTACTS', '/about': 'ABOUT', '/banquets': 'BANQUETS', '/promotions': 'PROMOTIONS' }
    const page = await db.managedPage.findUnique({ where: { key: keyMap[path] as never }, select: { seoTitle: true, seoDescription: true, seoImageUrl: true, updatedAt: true } })
    return c.json({ page: { key: `managed:${keyMap[path]}`, path, label: managed[1], title: page?.seoTitle ?? null, description: page?.seoDescription ?? null, imageUrl: page?.seoImageUrl ?? null, canonicalUrl: null, noindex: false, updatedAt: page?.updatedAt.toISOString() ?? null } }, 200)
  })

  adminRoutes.openapi(list, async (c) => {
    const [records, content, products, restaurants, jobs] = await Promise.all([
      db.seoMetadata.findMany({ orderBy: { path: 'asc' } }),
      db.contentEntry.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, slug: true, title: true, type: true }, orderBy: { title: 'asc' } }),
      db.product.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, slug: true, name: true, type: true }, orderBy: { name: 'asc' } }),
      db.restaurant.findMany({ select: { id: true, slug: true, name: true }, orderBy: { name: 'asc' } }),
      db.jobOpening.findMany({ where: { OR: [{ status: 'PUBLISHED' }, { status: null, isPublished: true }] }, select: { id: true, slug: true, title: true }, orderBy: { title: 'asc' } }),
    ])
    const byPath = new Map(records.map((record) => [record.path, dto(record)]))
    for (const [path, label] of staticPages) if (!byPath.has(path)) byPath.set(path, { key: `path:${path}`, path, label, title: null, description: null, imageUrl: null, canonicalUrl: null, noindex: false, updatedAt: null })
    for (const entry of content) { const path = `/${entry.type === 'ARTICLE' ? 'journal' : entry.type === 'EVENT' ? 'events' : 'promotions'}/${entry.slug}`; if (!byPath.has(path)) byPath.set(path, { key: `content:${entry.id}`, path, label: entry.title, title: null, description: null, imageUrl: null, canonicalUrl: null, noindex: false, updatedAt: null }) }
    for (const item of products) { const target = `/${item.type === 'COFFEE' ? 'coffee' : 'bakery'}/${item.slug}`; if (!byPath.has(target)) byPath.set(target, { key: `product:${item.id}`, path: target, label: item.name, title: null, description: null, imageUrl: null, canonicalUrl: null, noindex: false, updatedAt: null }) }
    for (const item of restaurants) { const path = `/restaurants/${item.slug}`; if (!byPath.has(path)) byPath.set(path, { key: `restaurant:${item.id}`, path, label: item.name, title: null, description: null, imageUrl: null, canonicalUrl: null, noindex: false, updatedAt: null }) }
    for (const item of jobs) { const path = `/jobs/${item.slug}`; if (!byPath.has(path)) byPath.set(path, { key: `job:${item.id}`, path, label: item.title, title: null, description: null, imageUrl: null, canonicalUrl: null, noindex: false, updatedAt: null }) }
    return c.json({ pages: [...byPath.values()] }, 200)
  })
  adminRoutes.openapi(upsert, async (c) => {
    const input = c.req.valid('json')
    const record = await db.seoMetadata.upsert({ where: { key: c.req.valid('param').key }, create: input, update: { path: input.path, label: input.label, title: input.title, description: input.description, imageUrl: input.imageUrl } })
    return c.json({ page: dto(record) }, 200)
  })
  return { routes, adminRoutes }
}
