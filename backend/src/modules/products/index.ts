import {
  productDetailSchema,
  productListResponseSchema,
  productResponseSchema,
  productTypeSchema,
  productVariantInputSchema,
  upsertProductRequestSchema,
  type Product,
  type UpsertProductRequest,
} from '@chashka-coffee/contracts'
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
const includeVariants = { variants: { orderBy: { position: 'asc' as const } } }

type ProductRecord = {
  id: string
  type: 'COFFEE' | 'CAKE'
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  slug: string
  name: string
  subtitle: string | null
  description: string | null
  ingredients: string | null
  origin: string | null
  roastLevel: string | null
  tastingNotes: unknown
  imageUrl: string | null
  galleryUrls: unknown
  details: unknown
  isFeatured: boolean
  position: number
  createdAt: Date
  updatedAt: Date
  variants: Array<{ id: string; label: string; weightGrams: number | null; priceKopecks: number; position: number; isAvailable: boolean }>
}

function dto(product: ProductRecord): Product {
  return {
    ...product,
    tastingNotes: z.array(z.string()).parse(product.tastingNotes),
    galleryUrls: z.array(z.string()).parse(product.galleryUrls),
    details: z.array(productDetailSchema).parse(product.details),
    variants: product.variants.map((variant) => ({ ...productVariantInputSchema.parse(variant), id: variant.id })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

function data(input: UpsertProductRequest) {
  const { variants, ...product } = input
  return { product, variants }
}

export function createProductsModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('*', requireAuth, requireAdmin)

  const publicList = createRoute({ method: 'get', path: '/', request: { query: z.object({ type: productTypeSchema }) }, responses: { 200: { content: { 'application/json': { schema: productListResponseSchema } }, description: 'Published products' } } })
  const publicDetail = createRoute({ method: 'get', path: '/{slug}', request: { params: slugParams }, responses: { 200: { content: { 'application/json': { schema: productResponseSchema } }, description: 'Published product' }, 404: { content: errorContent, description: 'Product not found' } } })
  const adminList = createRoute({ method: 'get', path: '/products', request: { query: z.object({ type: productTypeSchema.optional() }) }, responses: { 200: { content: { 'application/json': { schema: productListResponseSchema } }, description: 'Products' } } })
  const create = createRoute({ method: 'post', path: '/products', request: { body: { content: { 'application/json': { schema: upsertProductRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: productResponseSchema } }, description: 'Product created' } } })
  const update = createRoute({ method: 'put', path: '/products/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertProductRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: productResponseSchema } }, description: 'Product updated' }, 404: { content: errorContent, description: 'Product not found' } } })

  routes.openapi(publicList, async (c) => {
    const products = await db.product.findMany({ where: { type: c.req.valid('query').type, status: 'PUBLISHED' }, include: includeVariants, orderBy: [{ isFeatured: 'desc' }, { position: 'asc' }, { name: 'asc' }] })
    return c.json({ products: products.map((product) => dto(product as ProductRecord)) }, 200)
  })
  routes.openapi(publicDetail, async (c) => {
    const product = await db.product.findFirst({ where: { slug: c.req.valid('param').slug, status: 'PUBLISHED' }, include: includeVariants })
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found')
    return c.json({ product: dto(product as ProductRecord) }, 200)
  })
  adminRoutes.openapi(adminList, async (c) => {
    const type = c.req.valid('query').type
    const products = await db.product.findMany({ where: type ? { type } : {}, include: includeVariants, orderBy: [{ type: 'asc' }, { position: 'asc' }, { name: 'asc' }] })
    return c.json({ products: products.map((product) => dto(product as ProductRecord)) }, 200)
  })
  adminRoutes.openapi(create, async (c) => {
    const input = data(c.req.valid('json'))
    const product = await db.product.create({ data: { ...input.product, variants: { create: input.variants } }, include: includeVariants })
    return c.json({ product: dto(product as ProductRecord) }, 201)
  })
  adminRoutes.openapi(update, async (c) => {
    const input = data(c.req.valid('json'))
    try {
      const product = await db.product.update({ where: { id: c.req.valid('param').id }, data: { ...input.product, variants: { deleteMany: {}, create: input.variants } }, include: includeVariants })
      return c.json({ product: dto(product as ProductRecord) }, 200)
    } catch {
      throw new AppError(404, 'NOT_FOUND', 'Product not found')
    }
  })

  return { routes, adminRoutes }
}
