import { z } from 'zod'

const uuid = z.uuid()
const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const nullableText = (max: number) => z.string().trim().max(max).nullable()
const nullableUrl = z.url().nullable()

export const contentEntryTypeSchema = z.enum(['PROMOTION', 'EVENT'])
export const publicationStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
export const contentEntrySchema = z.object({
  id: uuid, type: contentEntryTypeSchema, status: publicationStatusSchema, slug,
  title: z.string().trim().min(1).max(180), excerpt: nullableText(500), body: nullableText(20_000), imageUrl: nullableUrl,
  ctaLabel: nullableText(80), ctaUrl: nullableUrl, startsAt: z.string().datetime().nullable(), endsAt: z.string().datetime().nullable(),
  eventStartsAt: z.string().datetime().nullable(), location: nullableText(220), isFeatured: z.boolean(), position: z.number().int().nonnegative(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
})
export type ContentEntry = z.infer<typeof contentEntrySchema>
export const upsertContentEntryRequestSchema = contentEntrySchema.omit({ id: true, createdAt: true, updatedAt: true }).strict()
export type UpsertContentEntryRequest = z.infer<typeof upsertContentEntryRequestSchema>
export const contentEntryListResponseSchema = z.object({ entries: z.array(contentEntrySchema) })
export const contentEntryResponseSchema = z.object({ entry: contentEntrySchema })
