import { z } from 'zod'

const uuid = z.uuid()
const nullableText = (max: number) => z.string().trim().max(max).nullable()
const publicUrl = z.string().trim().min(1).max(2_048).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), 'Expected an absolute URL or a site-relative path')
const nullablePublicUrl = publicUrl.nullable()

export const homepageSlideMediaTypeSchema = z.enum(['IMAGE', 'VIDEO'])
export type HomepageSlideMediaType = z.infer<typeof homepageSlideMediaTypeSchema>

export const homepageSlideSchema = z.object({
  id: uuid,
  mediaType: homepageSlideMediaTypeSchema,
  mediaUrl: publicUrl,
  posterUrl: nullablePublicUrl,
  eyebrow: nullableText(80),
  title: z.string().trim().min(1).max(180),
  description: nullableText(500),
  ctaLabel: nullableText(80),
  ctaUrl: nullablePublicUrl,
  durationSeconds: z.number().int().min(3).max(30),
  isPublished: z.boolean(),
  position: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type HomepageSlide = z.infer<typeof homepageSlideSchema>
export const upsertHomepageSlideRequestSchema = homepageSlideSchema.omit({ id: true, createdAt: true, updatedAt: true }).strict()
export type UpsertHomepageSlideRequest = z.infer<typeof upsertHomepageSlideRequestSchema>

export const homepageBestsellerMenuItemSchema = z.object({
  id: uuid,
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  description: nullableText(1_000),
  priceKopecks: z.number().int().nonnegative(),
  imageUrl: nullablePublicUrl,
  marketingBadge: z.enum(['NEW', 'HIT', 'SEASONAL', 'SPECIAL']).nullable(),
  categoryName: z.string().trim().min(1).max(100),
})
export type HomepageBestsellerMenuItem = z.infer<typeof homepageBestsellerMenuItemSchema>

export const homepageBestsellerSchema = z.object({
  id: uuid,
  menuItemId: uuid,
  badge: nullableText(40),
  position: z.number().int().nonnegative(),
  isPublished: z.boolean(),
  item: homepageBestsellerMenuItemSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type HomepageBestseller = z.infer<typeof homepageBestsellerSchema>
export const upsertHomepageBestsellerRequestSchema = homepageBestsellerSchema.omit({ id: true, item: true, createdAt: true, updatedAt: true }).strict()
export type UpsertHomepageBestsellerRequest = z.infer<typeof upsertHomepageBestsellerRequestSchema>

export const homepagePublicResponseSchema = z.object({
  slides: z.array(homepageSlideSchema),
  bestsellers: z.array(homepageBestsellerSchema),
})
export type HomepagePublicResponse = z.infer<typeof homepagePublicResponseSchema>

export const homepageAdminResponseSchema = homepagePublicResponseSchema.extend({
  menuItems: z.array(homepageBestsellerMenuItemSchema),
})
export type HomepageAdminResponse = z.infer<typeof homepageAdminResponseSchema>

export const homepageSlideResponseSchema = z.object({ slide: homepageSlideSchema })
export const homepageBestsellerResponseSchema = z.object({ bestseller: homepageBestsellerSchema })
export const homepageOperationSuccessResponseSchema = z.object({ success: z.literal(true) })
