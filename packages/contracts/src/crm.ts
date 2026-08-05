import { z } from 'zod'

import { leadSchema } from './leads'
import { orderSchema } from './orders'

const uuid = z.uuid()
const isoDate = z.string().datetime()
const nullableEmailInput = z.union([z.email().max(320), z.literal(''), z.null()])
  .transform((value) => value === '' ? null : value)

export const crmCustomerStatusSchema = z.enum(['ACTIVE', 'ARCHIVED'])
export type CrmCustomerStatus = z.infer<typeof crmCustomerStatusSchema>

export const crmCustomerSegmentSchema = z.enum(['ALL', 'NEW', 'REPEAT', 'VIP', 'INACTIVE_30', 'INACTIVE_90'])
export type CrmCustomerSegment = z.infer<typeof crmCustomerSegmentSchema>

export const crmCustomerSortSchema = z.enum(['LAST_ORDER_DESC', 'TOTAL_SPENT_DESC', 'ORDER_COUNT_DESC', 'NEWEST_DESC'])
export type CrmCustomerSort = z.infer<typeof crmCustomerSortSchema>

export const crmCustomerListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: crmCustomerStatusSchema.default('ACTIVE'),
  segment: crmCustomerSegmentSchema.default('ALL'),
  sort: crmCustomerSortSchema.default('LAST_ORDER_DESC'),
})
export type CrmCustomerListQuery = z.infer<typeof crmCustomerListQuerySchema>

export const crmTagSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(80),
  color: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
}).strict()
export type CrmTag = z.infer<typeof crmTagSchema>

export const crmCustomerMetricsSchema = z.object({
  orderCount: z.number().int().nonnegative(),
  paidOrderCount: z.number().int().nonnegative(),
  totalSpentKopecks: z.number().int().nonnegative(),
  averageCheckKopecks: z.number().int().nonnegative(),
  firstOrderAt: isoDate.nullable(),
  lastOrderAt: isoDate.nullable(),
}).strict()
export type CrmCustomerMetrics = z.infer<typeof crmCustomerMetricsSchema>

export const crmCustomerSummarySchema = z.object({
  id: uuid,
  name: z.string().min(1).max(180),
  phone: z.string().min(1).max(20),
  email: z.string().nullable(),
  status: crmCustomerStatusSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
  tags: z.array(crmTagSchema),
  metrics: crmCustomerMetricsSchema,
}).strict()
export type CrmCustomerSummary = z.infer<typeof crmCustomerSummarySchema>

export const crmCustomerNoteSchema = z.object({
  id: uuid,
  body: z.string().min(1).max(4_000),
  author: z.object({ id: uuid, displayName: z.string().nullable(), email: z.string() }).nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
}).strict()
export type CrmCustomerNote = z.infer<typeof crmCustomerNoteSchema>

export const crmCustomerConsentSchema = z.object({
  id: uuid,
  channel: z.enum(['PUSH', 'EMAIL', 'SMS']),
  status: z.enum(['GRANTED', 'WITHDRAWN']),
  source: z.string(),
  grantedAt: isoDate.nullable(),
  withdrawnAt: isoDate.nullable(),
  updatedAt: isoDate,
}).strict()

export const crmCustomerDetailSchema = crmCustomerSummarySchema.extend({
  orders: z.array(orderSchema),
  leads: z.array(leadSchema),
  notes: z.array(crmCustomerNoteSchema),
  consents: z.array(crmCustomerConsentSchema),
  activePushSubscriptions: z.number().int().nonnegative(),
})
export type CrmCustomerDetail = z.infer<typeof crmCustomerDetailSchema>

export const crmCustomerListResponseSchema = z.object({
  customers: z.array(crmCustomerSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
}).strict()
export const crmCustomerResponseSchema = z.object({ customer: crmCustomerDetailSchema }).strict()
export const crmTagListResponseSchema = z.object({ tags: z.array(crmTagSchema) }).strict()
export const crmTagResponseSchema = z.object({ tag: crmTagSchema }).strict()
export const crmCustomerNoteResponseSchema = z.object({ note: crmCustomerNoteSchema }).strict()

export const updateCrmCustomerRequestSchema = z.object({
  name: z.string().trim().min(1).max(180),
  email: nullableEmailInput,
  status: crmCustomerStatusSchema,
}).strict()
export type UpdateCrmCustomerRequest = z.infer<typeof updateCrmCustomerRequestSchema>

export const createCrmCustomerNoteRequestSchema = z.object({ body: z.string().trim().min(1).max(4_000) }).strict()
export const createCrmTagRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).nullable().transform((value) => value?.toLowerCase() ?? null),
}).strict()
export const setCrmCustomerTagsRequestSchema = z.object({
  tagIds: z.array(uuid).max(30).refine((ids) => new Set(ids).size === ids.length, 'Tag ids must be unique'),
}).strict()

const crmAnalyticsDailyPointSchema = z.object({
  date: z.string(),
  revenueKopecks: z.number().int().nonnegative(),
  paidOrders: z.number().int().nonnegative(),
  newCustomers: z.number().int().nonnegative(),
}).strict()

export const crmAnalyticsResponseSchema = z.object({
  periodDays: z.number().int().positive(),
  overview: z.object({
    revenueKopecks: z.number().int().nonnegative(),
    paidOrders: z.number().int().nonnegative(),
    averageCheckKopecks: z.number().int().nonnegative(),
    newCustomers: z.number().int().nonnegative(),
    returningCustomers: z.number().int().nonnegative(),
    repeatRatePercent: z.number().min(0).max(100),
    cancelledOrders: z.number().int().nonnegative(),
  }).strict(),
  previous: z.object({
    revenueKopecks: z.number().int().nonnegative(),
    paidOrders: z.number().int().nonnegative(),
  }).strict(),
  daily: z.array(crmAnalyticsDailyPointSchema),
  topProducts: z.array(z.object({
    name: z.string(),
    quantity: z.number().int().nonnegative(),
    revenueKopecks: z.number().int().nonnegative(),
  }).strict()),
  topPickupLocations: z.array(z.object({
    name: z.string(),
    paidOrders: z.number().int().nonnegative(),
    revenueKopecks: z.number().int().nonnegative(),
  }).strict()),
}).strict()
export type CrmAnalyticsResponse = z.infer<typeof crmAnalyticsResponseSchema>
