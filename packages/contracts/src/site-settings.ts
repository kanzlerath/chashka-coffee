import { z } from 'zod'

const imageUrlSchema = z.string().trim().min(1).max(2_048).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), 'Expected an absolute URL or a site-relative path')

export const siteHeaderPreviewSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(500),
  imageUrl: imageUrlSchema,
  imageAlt: z.string().trim().max(240),
}).strict()
export type SiteHeaderPreview = z.infer<typeof siteHeaderPreviewSchema>

export const siteSettingsSchema = z.object({
  headerPreviews: z.array(siteHeaderPreviewSchema).max(16),
  updatedAt: z.string().datetime(),
})
export type SiteSettings = z.infer<typeof siteSettingsSchema>

export const upsertSiteSettingsRequestSchema = siteSettingsSchema.omit({ updatedAt: true }).strict()
export type UpsertSiteSettingsRequest = z.infer<typeof upsertSiteSettingsRequestSchema>
export const siteSettingsResponseSchema = z.object({ settings: siteSettingsSchema })
