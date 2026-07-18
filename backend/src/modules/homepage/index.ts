import {
  homepageAdminResponseSchema,
  homepageBestsellerResponseSchema,
  homepageDayPartResponseSchema,
  homepageDaySectionResponseSchema,
  homepageOperationSuccessResponseSchema,
  homepagePublicResponseSchema,
  homepageSlideResponseSchema,
  upsertHomepageBestsellerRequestSchema,
  upsertHomepageDayPartRequestSchema,
  upsertHomepageDaySectionRequestSchema,
  upsertHomepageSlideRequestSchema,
  type HomepageBestseller,
  type HomepageDayPart,
  type HomepageDaySection,
  type HomepageBestsellerMenuItem,
  type HomepageSlide,
  type UpsertHomepageBestsellerRequest,
  type UpsertHomepageDayPartRequest,
  type UpsertHomepageDaySectionRequest,
  type UpsertHomepageSlideRequest,
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

type MenuItemWithCategory = {
  id: string
  slug: string
  name: string
  description: string | null
  weightGrams: number | null
  priceKopecks: number
  imageUrl: string | null
  marketingBadge: 'NEW' | 'HIT' | 'SEASONAL' | 'SPECIAL' | null
  category: { name: string }
}

type HomepageBestsellerWithItem = {
  id: string
  menuItemId: string
  badge: string | null
  position: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
  menuItem: MenuItemWithCategory
}

type HomepageDayPartRecord = {
  id: string
  sectionId: string
  label: string
  title: string
  description: string | null
  ctaUrl: string | null
  position: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

type HomepageDaySectionRecord = {
  id: string
  title: string
  description: string | null
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
  parts: HomepageDayPartRecord[]
}

function menuItemDto(item: MenuItemWithCategory): HomepageBestsellerMenuItem {
  return { id: item.id, slug: item.slug, name: item.name, description: item.description, weightGrams: item.weightGrams, priceKopecks: item.priceKopecks, imageUrl: item.imageUrl, marketingBadge: item.marketingBadge, categoryName: item.category.name }
}

function slideDto(slide: { id: string; mediaType: 'IMAGE' | 'VIDEO'; mediaUrl: string; posterUrl: string | null; eyebrow: string | null; title: string; description: string | null; ctaLabel: string | null; ctaUrl: string | null; durationSeconds: number; isPublished: boolean; position: number; createdAt: Date; updatedAt: Date }): HomepageSlide {
  return { ...slide, createdAt: slide.createdAt.toISOString(), updatedAt: slide.updatedAt.toISOString() }
}

function bestsellerDto(bestseller: HomepageBestsellerWithItem): HomepageBestseller {
  return { id: bestseller.id, menuItemId: bestseller.menuItemId, badge: bestseller.badge, position: bestseller.position, isPublished: bestseller.isPublished, item: menuItemDto(bestseller.menuItem), createdAt: bestseller.createdAt.toISOString(), updatedAt: bestseller.updatedAt.toISOString() }
}

function dayPartDto(part: HomepageDayPartRecord): HomepageDayPart {
  return { ...part, createdAt: part.createdAt.toISOString(), updatedAt: part.updatedAt.toISOString() }
}

function daySectionDto(section: HomepageDaySectionRecord): HomepageDaySection {
  return { ...section, parts: section.parts.map(dayPartDto), createdAt: section.createdAt.toISOString(), updatedAt: section.updatedAt.toISOString() }
}

function slideInput(input: UpsertHomepageSlideRequest) {
  return input
}

function bestsellerInput(input: UpsertHomepageBestsellerRequest) {
  return input
}

function daySectionInput(input: UpsertHomepageDaySectionRequest) {
  return input
}

function dayPartInput(input: UpsertHomepageDayPartRequest) {
  return input
}

export function createHomepageModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('*', requireAuth, requireAdmin)

  const publicHomepage = createRoute({ method: 'get', path: '/', responses: { 200: { content: { 'application/json': { schema: homepagePublicResponseSchema } }, description: 'Published homepage content' } } })
  const adminHomepage = createRoute({ method: 'get', path: '/homepage', responses: { 200: { content: { 'application/json': { schema: homepageAdminResponseSchema } }, description: 'Homepage editor data' } } })
  const createSlide = createRoute({ method: 'post', path: '/homepage/slides', request: { body: { content: { 'application/json': { schema: upsertHomepageSlideRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: homepageSlideResponseSchema } }, description: 'Homepage slide created' } } })
  const updateSlide = createRoute({ method: 'put', path: '/homepage/slides/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertHomepageSlideRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: homepageSlideResponseSchema } }, description: 'Homepage slide updated' }, 404: { content: errorContent, description: 'Homepage slide not found' } } })
  const deleteSlide = createRoute({ method: 'delete', path: '/homepage/slides/{id}', request: { params: idParams }, responses: { 200: { content: { 'application/json': { schema: homepageOperationSuccessResponseSchema } }, description: 'Homepage slide deleted' }, 404: { content: errorContent, description: 'Homepage slide not found' } } })
  const createBestseller = createRoute({ method: 'post', path: '/homepage/bestsellers', request: { body: { content: { 'application/json': { schema: upsertHomepageBestsellerRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: homepageBestsellerResponseSchema } }, description: 'Homepage bestseller created' } } })
  const updateBestseller = createRoute({ method: 'put', path: '/homepage/bestsellers/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertHomepageBestsellerRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: homepageBestsellerResponseSchema } }, description: 'Homepage bestseller updated' }, 404: { content: errorContent, description: 'Homepage bestseller not found' } } })
  const deleteBestseller = createRoute({ method: 'delete', path: '/homepage/bestsellers/{id}', request: { params: idParams }, responses: { 200: { content: { 'application/json': { schema: homepageOperationSuccessResponseSchema } }, description: 'Homepage bestseller deleted' }, 404: { content: errorContent, description: 'Homepage bestseller not found' } } })
  const createDaySection = createRoute({ method: 'post', path: '/homepage/day-section', request: { body: { content: { 'application/json': { schema: upsertHomepageDaySectionRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: homepageDaySectionResponseSchema } }, description: 'Homepage day section created' } } })
  const updateDaySection = createRoute({ method: 'put', path: '/homepage/day-section/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertHomepageDaySectionRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: homepageDaySectionResponseSchema } }, description: 'Homepage day section updated' }, 404: { content: errorContent, description: 'Homepage day section not found' } } })
  const createDayPart = createRoute({ method: 'post', path: '/homepage/day-parts', request: { body: { content: { 'application/json': { schema: upsertHomepageDayPartRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: homepageDayPartResponseSchema } }, description: 'Homepage day part created' } } })
  const updateDayPart = createRoute({ method: 'put', path: '/homepage/day-parts/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertHomepageDayPartRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: homepageDayPartResponseSchema } }, description: 'Homepage day part updated' }, 404: { content: errorContent, description: 'Homepage day part not found' } } })
  const deleteDayPart = createRoute({ method: 'delete', path: '/homepage/day-parts/{id}', request: { params: idParams }, responses: { 200: { content: { 'application/json': { schema: homepageOperationSuccessResponseSchema } }, description: 'Homepage day part deleted' }, 404: { content: errorContent, description: 'Homepage day part not found' } } })

  routes.openapi(publicHomepage, async (c) => {
    const [slides, bestsellers, daySection] = await Promise.all([
      db.homepageSlide.findMany({ where: { isPublished: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      db.homepageBestseller.findMany({ where: { isPublished: true }, include: { menuItem: { include: { category: true } } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      db.homepageDaySection.findFirst({ where: { isPublished: true }, include: { parts: { where: { isPublished: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } }, orderBy: { createdAt: 'asc' } }),
    ])
    return c.json({ slides: slides.map(slideDto), bestsellers: bestsellers.map(bestsellerDto), daySection: daySection ? daySectionDto(daySection) : null }, 200)
  })

  adminRoutes.openapi(adminHomepage, async (c) => {
    const [slides, bestsellers, menuItems, daySection] = await Promise.all([
      db.homepageSlide.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      db.homepageBestseller.findMany({ include: { menuItem: { include: { category: true } } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      db.menuItem.findMany({ include: { category: true }, orderBy: [{ category: { position: 'asc' } }, { position: 'asc' }, { name: 'asc' }] }),
      db.homepageDaySection.findFirst({ include: { parts: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } }, orderBy: { createdAt: 'asc' } }),
    ])
    const uniqueMenuItems = [...new Map(menuItems.map((item) => [item.slug, item])).values()]
    return c.json({ slides: slides.map(slideDto), bestsellers: bestsellers.map(bestsellerDto), daySection: daySection ? daySectionDto(daySection) : null, menuItems: uniqueMenuItems.map(menuItemDto) }, 200)
  })

  adminRoutes.openapi(createSlide, async (c) => {
    const slide = await db.homepageSlide.create({ data: slideInput(c.req.valid('json')) })
    return c.json({ slide: slideDto(slide) }, 201)
  })
  adminRoutes.openapi(updateSlide, async (c) => {
    try {
      const slide = await db.homepageSlide.update({ where: { id: c.req.valid('param').id }, data: slideInput(c.req.valid('json')) })
      return c.json({ slide: slideDto(slide) }, 200)
    } catch {
      throw new AppError(404, 'NOT_FOUND', 'Homepage slide not found')
    }
  })
  adminRoutes.openapi(deleteSlide, async (c) => {
    try {
      await db.homepageSlide.delete({ where: { id: c.req.valid('param').id } })
      return c.json({ success: true as const }, 200)
    } catch {
      throw new AppError(404, 'NOT_FOUND', 'Homepage slide not found')
    }
  })
  adminRoutes.openapi(createBestseller, async (c) => {
    const bestseller = await db.homepageBestseller.create({ data: bestsellerInput(c.req.valid('json')), include: { menuItem: { include: { category: true } } } })
    return c.json({ bestseller: bestsellerDto(bestseller) }, 201)
  })
  adminRoutes.openapi(updateBestseller, async (c) => {
    try {
      const bestseller = await db.homepageBestseller.update({ where: { id: c.req.valid('param').id }, data: bestsellerInput(c.req.valid('json')), include: { menuItem: { include: { category: true } } } })
      return c.json({ bestseller: bestsellerDto(bestseller) }, 200)
    } catch {
      throw new AppError(404, 'NOT_FOUND', 'Homepage bestseller not found')
    }
  })
  adminRoutes.openapi(deleteBestseller, async (c) => {
    try {
      await db.homepageBestseller.delete({ where: { id: c.req.valid('param').id } })
      return c.json({ success: true as const }, 200)
    } catch {
      throw new AppError(404, 'NOT_FOUND', 'Homepage bestseller not found')
    }
  })
  adminRoutes.openapi(createDaySection, async (c) => {
    const section = await db.homepageDaySection.create({ data: daySectionInput(c.req.valid('json')), include: { parts: true } })
    return c.json({ daySection: daySectionDto(section) }, 201)
  })
  adminRoutes.openapi(updateDaySection, async (c) => {
    try {
      const section = await db.homepageDaySection.update({ where: { id: c.req.valid('param').id }, data: daySectionInput(c.req.valid('json')), include: { parts: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } } })
      return c.json({ daySection: daySectionDto(section) }, 200)
    } catch {
      throw new AppError(404, 'NOT_FOUND', 'Homepage day section not found')
    }
  })
  adminRoutes.openapi(createDayPart, async (c) => {
    const part = await db.homepageDayPart.create({ data: dayPartInput(c.req.valid('json')) })
    return c.json({ dayPart: dayPartDto(part) }, 201)
  })
  adminRoutes.openapi(updateDayPart, async (c) => {
    try {
      const part = await db.homepageDayPart.update({ where: { id: c.req.valid('param').id }, data: dayPartInput(c.req.valid('json')) })
      return c.json({ dayPart: dayPartDto(part) }, 200)
    } catch {
      throw new AppError(404, 'NOT_FOUND', 'Homepage day part not found')
    }
  })
  adminRoutes.openapi(deleteDayPart, async (c) => {
    try {
      await db.homepageDayPart.delete({ where: { id: c.req.valid('param').id } })
      return c.json({ success: true as const }, 200)
    } catch {
      throw new AppError(404, 'NOT_FOUND', 'Homepage day part not found')
    }
  })

  return { routes, adminRoutes }
}
