import {
  contentBlockListSchema,
  cardImageCropSchema,
  productDetailSchema,
  productDeleteResponseSchema,
  productListResponseSchema,
  productResponseSchema,
  productTypeSchema,
  productVariantInputSchema,
  importCakeProductsRequestSchema,
  upsertProductRequestSchema,
  type Product,
  type UpsertProductRequest,
  type ImportCakeProductsRequest,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { DbClient } from '../../db'
import { Prisma } from '../../generated/prisma/client'
import { AppError, validationErrorHook } from '../../http/errors'
import type { AuthHttpEnv } from '../auth'
import { nextCopyIdentity } from '../../copy-identity'

const idParams = z.object({ id: z.uuid() })
const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) })
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })
const errorContent = { 'application/json': { schema: errorSchema } }
const includeVariants = { variants: { orderBy: { position: 'asc' as const } } }

type ProductRecord = {
  id: string
  type: 'COFFEE' | 'CAKE'
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'
  publishAt: Date | null
  slug: string
  name: string
  category: string | null
  subtitle: string | null
  description: string | null
  ingredients: string | null
  origin: string | null
  roastLevel: string | null
  tastingNotes: unknown
  imageUrl: string | null
  imageCrop: unknown
  galleryUrls: unknown
  details: unknown
  blocks: unknown
  isFeatured: boolean
  position: number
  createdAt: Date
  updatedAt: Date
  variants: Array<{ id: string; label: string; weightGrams: number | null; priceKopecks: number; position: number; isAvailable: boolean }>
}

function dto(product: ProductRecord): Product {
  return {
    ...product,
    publishAt: product.publishAt?.toISOString() ?? null,
    tastingNotes: z.array(z.string()).parse(product.tastingNotes),
    galleryUrls: z.array(z.string()).parse(product.galleryUrls),
    imageCrop: product.imageCrop === null ? null : cardImageCropSchema.parse(product.imageCrop),
    details: z.array(productDetailSchema).parse(product.details),
    blocks: contentBlockListSchema.parse(product.blocks),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      ...productVariantInputSchema.parse({
        label: variant.label,
        weightGrams: variant.weightGrams,
        priceKopecks: variant.priceKopecks,
        position: variant.position,
        isAvailable: variant.isAvailable,
      }),
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

function data(input: UpsertProductRequest) {
  const { variants, ...product } = input
  return { product: { ...product, imageCrop: product.imageCrop ?? Prisma.JsonNull, publishAt: product.publishAt ? new Date(product.publishAt) : null }, variants }
}

async function availableProductSlug(db: DbClient, requestedSlug: string) {
  const matches = await db.product.findMany({
    where: { slug: { startsWith: requestedSlug } },
    select: { slug: true },
  })
  const occupied = new Set(matches.map(({ slug }) => slug))
  if (!occupied.has(requestedSlug)) return requestedSlug

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const ending = `-${suffix}`
    const candidate = `${requestedSlug.slice(0, 120 - ending.length)}${ending}`
    if (!occupied.has(candidate)) return candidate
  }

  throw new AppError(409, 'CONFLICT', 'Не удалось подобрать свободный адрес страницы.')
}

function productWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') throw new AppError(404, 'NOT_FOUND', 'Товар не найден.')
    if (error.code === 'P2002') throw new AppError(409, 'CONFLICT', 'Этот адрес страницы уже занят. Укажите другой.')
  }
  throw error
}

export function createProductsModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('/products', requireAuth, requireAdmin)
  adminRoutes.use('/products/*', requireAuth, requireAdmin)

  const publicList = createRoute({ method: 'get', path: '/', request: { query: z.object({ type: productTypeSchema }) }, responses: { 200: { content: { 'application/json': { schema: productListResponseSchema } }, description: 'Published products' } } })
  const publicDetail = createRoute({ method: 'get', path: '/{slug}', request: { params: slugParams }, responses: { 200: { content: { 'application/json': { schema: productResponseSchema } }, description: 'Published product' }, 404: { content: errorContent, description: 'Product not found' } } })
  const adminList = createRoute({ method: 'get', path: '/products', request: { query: z.object({ type: productTypeSchema.optional() }) }, responses: { 200: { content: { 'application/json': { schema: productListResponseSchema } }, description: 'Products' } } })
  const create = createRoute({ method: 'post', path: '/products', request: { body: { content: { 'application/json': { schema: upsertProductRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: productResponseSchema } }, description: 'Product created' }, 409: { content: errorContent, description: 'Product slug conflict' } } })
  const importCakes = createRoute({ method: 'post', path: '/products/import-cakes', request: { body: { content: { 'application/json': { schema: importCakeProductsRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: productListResponseSchema } }, description: 'Cake products imported atomically' }, 409: { content: errorContent, description: 'Product slug conflict' } } })
  const update = createRoute({ method: 'put', path: '/products/{id}', request: { params: idParams, body: { content: { 'application/json': { schema: upsertProductRequestSchema } } } }, responses: { 200: { content: { 'application/json': { schema: productResponseSchema } }, description: 'Product updated' }, 404: { content: errorContent, description: 'Product not found' }, 409: { content: errorContent, description: 'Product slug conflict' } } })
  const copy = createRoute({ method: 'post', path: '/products/{id}/copy', request: { params: idParams }, responses: { 201: { content: { 'application/json': { schema: productResponseSchema } }, description: 'Product copied' }, 404: { content: errorContent, description: 'Product not found' }, 409: { content: errorContent, description: 'Product copy conflict' } } })
  const remove = createRoute({ method: 'delete', path: '/products/{id}', request: { params: idParams }, responses: { 200: { content: { 'application/json': { schema: productDeleteResponseSchema } }, description: 'Product deleted' }, 404: { content: errorContent, description: 'Product not found' } } })

  routes.openapi(publicList, async (c) => {
    const now = new Date()
    const products = await db.product.findMany({ where: { type: c.req.valid('query').type, OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', publishAt: { lte: now } }] }, include: includeVariants, orderBy: [{ isFeatured: 'desc' }, { position: 'asc' }, { name: 'asc' }] })
    return c.json({ products: products.map((product) => dto(product as ProductRecord)) }, 200)
  })
  routes.openapi(publicDetail, async (c) => {
    const now = new Date()
    const product = await db.product.findFirst({ where: { slug: c.req.valid('param').slug, OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', publishAt: { lte: now } }] }, include: includeVariants })
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
    try {
      const slug = await availableProductSlug(db, input.product.slug)
      const product = await db.product.create({ data: { ...input.product, slug, variants: { create: input.variants } }, include: includeVariants })
      return c.json({ product: dto(product as ProductRecord) }, 201)
    } catch (error) {
      return productWriteError(error)
    }
  })
  adminRoutes.openapi(importCakes, async (c) => {
    const input = c.req.valid('json') as ImportCakeProductsRequest
    try {
      const products = await db.$transaction(async (transaction) => {
        const slugs = input.products.map((product) => product.slug)
        const occupied = await transaction.product.findMany({ where: { slug: { in: slugs } }, select: { slug: true } })
        if (occupied.length) throw new AppError(409, 'CONFLICT', `Адрес уже занят: ${occupied.map((product) => product.slug).join(', ')}`)
        return Promise.all(input.products.map(async (product) => {
          const inputData = data(product)
          return transaction.product.create({ data: { ...inputData.product, variants: { create: inputData.variants } }, include: includeVariants })
        }))
      })
      return c.json({ products: products.map((product) => dto(product as ProductRecord)) }, 201)
    } catch (error) {
      return productWriteError(error)
    }
  })
  adminRoutes.openapi(update, async (c) => {
    const input = data(c.req.valid('json'))
    try {
      const product = await db.product.update({ where: { id: c.req.valid('param').id }, data: { ...input.product, variants: { deleteMany: {}, create: input.variants } }, include: includeVariants })
      return c.json({ product: dto(product as ProductRecord) }, 200)
    } catch (error) {
      return productWriteError(error)
    }
  })
  adminRoutes.openapi(copy, async (c) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const source = await db.product.findUnique({ where: { id: c.req.valid('param').id }, include: includeVariants })
      if (!source) throw new AppError(404, 'NOT_FOUND', 'Product not found')
      const nameBase = source.name.replace(/ — копия(?: \d+)?$/, '')
      const slugBase = source.slug.replace(/-copy(?:-\d+)?$/, '')
      const occupied = await db.product.findMany({ where: { OR: [{ type: source.type, name: { startsWith: nameBase } }, { slug: { startsWith: slugBase } }] }, select: { name: true, slug: true } })
      const identity = nextCopyIdentity({ name: source.name, slug: source.slug, occupiedNames: occupied.map((product) => product.name), occupiedSlugs: occupied.map((product) => product.slug) })

      try {
        const product = await db.product.create({
          data: {
            type: source.type,
            status: 'DRAFT',
            publishAt: null,
            ...identity,
            category: source.category,
            subtitle: source.subtitle,
            description: source.description,
            ingredients: source.ingredients,
            origin: source.origin,
            roastLevel: source.roastLevel,
            tastingNotes: z.array(z.string()).parse(source.tastingNotes),
            imageUrl: source.imageUrl,
            imageCrop: source.imageCrop === null ? Prisma.JsonNull : source.imageCrop as Prisma.InputJsonValue,
            galleryUrls: z.array(z.string()).parse(source.galleryUrls),
            details: z.array(productDetailSchema).parse(source.details),
            blocks: contentBlockListSchema.parse(source.blocks),
            isFeatured: source.isFeatured,
            position: source.position,
            variants: { create: source.variants.map(({ label, weightGrams, priceKopecks, position, isAvailable }) => ({ label, weightGrams, priceKopecks, position, isAvailable })) },
          },
          include: includeVariants,
        })
        return c.json({ product: dto(product as ProductRecord) }, 201)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < 2) continue
        return productWriteError(error)
      }
    }
    throw new AppError(409, 'CONFLICT', 'Не удалось подобрать имя для копии.')
  })
  adminRoutes.openapi(remove, async (c) => {
    try {
      await db.product.delete({ where: { id: c.req.valid('param').id } })
      return c.json({ success: true as const }, 200)
    } catch (error) {
      return productWriteError(error)
    }
  })

  return { routes, adminRoutes }
}
