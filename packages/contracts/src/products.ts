import { z } from 'zod'

const uuid = z.uuid()
const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const nullableText = (max: number) => z.string().trim().max(max).nullable()
const publicUrl = z.string().trim().min(1).max(2_048).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), 'Expected an absolute URL or a site-relative path')

export const productTypeSchema = z.enum(['COFFEE', 'CAKE'])
export type ProductType = z.infer<typeof productTypeSchema>
export const productStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
export const productDetailSchema = z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(500) }).strict()

export const productVariantInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  weightGrams: z.number().int().positive().nullable(),
  priceKopecks: z.number().int().nonnegative(),
  position: z.number().int().nonnegative(),
  isAvailable: z.boolean(),
}).strict()
export const productVariantSchema = productVariantInputSchema.extend({ id: uuid })
export type ProductVariant = z.infer<typeof productVariantSchema>

const productFields = {
  type: productTypeSchema,
  status: productStatusSchema,
  slug,
  name: z.string().trim().min(1).max(180),
  subtitle: nullableText(180),
  description: nullableText(8_000),
  ingredients: nullableText(4_000),
  origin: nullableText(180),
  roastLevel: nullableText(80),
  tastingNotes: z.array(z.string().trim().min(1).max(80)).max(12),
  imageUrl: publicUrl.nullable(),
  galleryUrls: z.array(publicUrl).max(12),
  details: z.array(productDetailSchema).max(20),
  isFeatured: z.boolean(),
  position: z.number().int().nonnegative(),
}

export const upsertProductRequestSchema = z.object({
  ...productFields,
  variants: z.array(productVariantInputSchema).min(1).max(12),
}).strict()
export type UpsertProductRequest = z.infer<typeof upsertProductRequestSchema>

export const productSchema = z.object({
  id: uuid,
  ...productFields,
  variants: z.array(productVariantSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Product = z.infer<typeof productSchema>
export const productListResponseSchema = z.object({ products: z.array(productSchema) })
export const productResponseSchema = z.object({ product: productSchema })
