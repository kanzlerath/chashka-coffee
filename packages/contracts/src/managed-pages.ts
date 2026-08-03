import { z } from 'zod'

import { contentBlockListSchema } from './content'

export const managedPageKeySchema = z.enum([
  'HOME', 'COFFEE', 'RESTAURANTS', 'DELIVERY', 'APP', 'LOYALTY', 'CERTIFICATES', 'BAKERY',
  'FRANCHISE', 'JOBS', 'CONTACTS', 'ABOUT', 'BANQUETS', 'PROMOTIONS',
])
export type ManagedPageKey = z.infer<typeof managedPageKeySchema>

export const coffeeTasteSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(300),
  imageUrl: z.string().trim().min(1).max(2_048).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), 'Expected an absolute URL or a site-relative path'),
}).strict()
export type CoffeeTaste = z.infer<typeof coffeeTasteSchema>

const nullableHeroText = (max: number) => z.string().trim().min(1).max(max).nullable()
const nullableHeroUrl = z.string().trim().min(1).max(2_048).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), 'Expected an absolute URL or a site-relative path').nullable()

export const managedPageSchema = z.object({
  id: z.uuid(),
  key: managedPageKeySchema,
  title: z.string().trim().min(1).max(180),
  heroTitle: nullableHeroText(180),
  heroDescription: nullableHeroText(500),
  heroImageUrl: nullableHeroUrl,
  coffeeTastes: z.array(coffeeTasteSchema).min(1).max(12).nullable(),
  blocks: contentBlockListSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type ManagedPage = z.infer<typeof managedPageSchema>
export const upsertManagedPageRequestSchema = managedPageSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  heroTitle: nullableHeroText(180).optional(),
  heroDescription: nullableHeroText(500).optional(),
  heroImageUrl: nullableHeroUrl.optional(),
  coffeeTastes: z.array(coffeeTasteSchema).min(1).max(12).nullable().optional(),
}).strict()
export type UpsertManagedPageRequest = z.infer<typeof upsertManagedPageRequestSchema>
export const managedPageListResponseSchema = z.object({ pages: z.array(managedPageSchema) })
export const managedPageResponseSchema = z.object({ page: managedPageSchema })
