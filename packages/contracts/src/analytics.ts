import { z } from 'zod'

export const analyticsPageViewRequestSchema = z.object({
  path: z.string().trim().min(1).max(500),
  visitorId: z.uuid(),
  referrer: z.string().trim().max(1000).nullable().default(null),
  device: z.enum(['DESKTOP', 'TABLET', 'MOBILE']).default('DESKTOP'),
})

export const analyticsPageViewResponseSchema = z.object({ recorded: z.literal(true) })

const analyticsPointSchema = z.object({
  date: z.string(),
  views: z.number().int().nonnegative(),
  visitors: z.number().int().nonnegative(),
})

const analyticsPageSchema = z.object({
  path: z.string(),
  views: z.number().int().nonnegative(),
  visitors: z.number().int().nonnegative(),
})

const analyticsRecentViewSchema = z.object({
  id: z.string(),
  path: z.string(),
  visitorId: z.string(),
  referrer: z.string().nullable(),
  device: z.enum(['DESKTOP', 'TABLET', 'MOBILE']),
  createdAt: z.string().datetime(),
})

export const analyticsSummaryResponseSchema = z.object({
  periodDays: z.number().int().positive(),
  overview: z.object({
    views: z.number().int().nonnegative(),
    visitors: z.number().int().nonnegative(),
    todayViews: z.number().int().nonnegative(),
    newLeads: z.number().int().nonnegative(),
  }),
  daily: z.array(analyticsPointSchema),
  topPages: z.array(analyticsPageSchema),
  recent: z.array(analyticsRecentViewSchema),
})

export type AnalyticsPageViewRequest = z.infer<typeof analyticsPageViewRequestSchema>
export type AnalyticsSummaryResponse = z.infer<typeof analyticsSummaryResponseSchema>
