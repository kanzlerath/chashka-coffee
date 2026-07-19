import { z } from 'zod'

import { contentBlockListSchema } from './content'

export const managedPageKeySchema = z.enum([
  'HOME', 'COFFEE', 'RESTAURANTS', 'DELIVERY', 'APP', 'LOYALTY', 'CERTIFICATES', 'BAKERY',
  'FRANCHISE', 'JOBS', 'CONTACTS', 'ABOUT', 'BANQUETS', 'PROMOTIONS',
])
export type ManagedPageKey = z.infer<typeof managedPageKeySchema>

export const managedPageSchema = z.object({
  id: z.uuid(),
  key: managedPageKeySchema,
  title: z.string().trim().min(1).max(180),
  blocks: contentBlockListSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type ManagedPage = z.infer<typeof managedPageSchema>
export const upsertManagedPageRequestSchema = managedPageSchema.omit({ id: true, createdAt: true, updatedAt: true }).strict()
export type UpsertManagedPageRequest = z.infer<typeof upsertManagedPageRequestSchema>
export const managedPageListResponseSchema = z.object({ pages: z.array(managedPageSchema) })
export const managedPageResponseSchema = z.object({ page: managedPageSchema })
