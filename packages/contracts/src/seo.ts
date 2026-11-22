import { z } from 'zod'

const nullableText = (max: number) => z.string().trim().max(max).nullable()
const nullableUrl = z.string().trim().min(1).max(2_048).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), 'Expected an absolute URL or a site-relative path').nullable()

export const seoPageSchema = z.object({
  key: z.string().trim().min(1).max(160),
  path: z.string().trim().startsWith('/').max(300),
  label: z.string().trim().min(1).max(180),
  title: nullableText(180),
  description: nullableText(320),
  imageUrl: nullableUrl,
  updatedAt: z.string().datetime().nullable(),
}).strict()
export type SeoPage = z.infer<typeof seoPageSchema>
export const seoPageListResponseSchema = z.object({ pages: z.array(seoPageSchema) })
export const seoPageResponseSchema = z.object({ page: seoPageSchema })
export const upsertSeoPageRequestSchema = seoPageSchema.omit({ updatedAt: true }).strict()
export const publicSeoResponseSchema = z.object({ page: seoPageSchema.nullable() })
