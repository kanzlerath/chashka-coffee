import { z } from 'zod'

const uuid = z.uuid()

export const adminResourceSchema = z.enum(['LEAD', 'CONTENT', 'PRODUCT', 'JOB'])
export type AdminResource = z.infer<typeof adminResourceSchema>

export const adminSearchResultSchema = z.object({
  id: uuid,
  resource: z.enum(['RESTAURANT', 'MENU', 'LEAD', 'CONTENT', 'PRODUCT', 'JOB']),
  title: z.string().min(1).max(240),
  subtitle: z.string().max(500).nullable(),
  href: z.string().startsWith('/'),
  status: z.string().max(80).nullable(),
  updatedAt: z.string().datetime(),
}).strict()
export type AdminSearchResult = z.infer<typeof adminSearchResultSchema>

export const adminSearchResponseSchema = z.object({
  results: z.array(adminSearchResultSchema).max(40),
}).strict()

export const adminActionQueueSchema = z.object({
  key: z.enum(['NEW_LEADS', 'DRAFT_CONTENT', 'EXPIRED_CONTENT', 'DRAFT_PRODUCTS', 'DRAFT_JOBS', 'PENDING_MEDIA']),
  label: z.string().min(1).max(160),
  count: z.number().int().nonnegative(),
  href: z.string().startsWith('/'),
  tone: z.enum(['NEUTRAL', 'ATTENTION', 'URGENT']),
}).strict()
export type AdminActionQueue = z.infer<typeof adminActionQueueSchema>

export const auditEventSchema = z.object({
  id: uuid,
  actorId: uuid.nullable(),
  actorName: z.string().max(320),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'BULK_UPDATE']),
  resource: z.string().max(80),
  resourceId: z.string().max(120).nullable(),
  path: z.string().max(500),
  createdAt: z.string().datetime(),
}).strict()
export type AuditEvent = z.infer<typeof auditEventSchema>

export const adminWorkspaceResponseSchema = z.object({
  queues: z.array(adminActionQueueSchema),
  recentActivity: z.array(auditEventSchema).max(20),
}).strict()

export const adminActivityResponseSchema = z.object({
  events: z.array(auditEventSchema).max(100),
}).strict()

const publicationBulkStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
const leadBulkStatusSchema = z.enum(['NEW', 'IN_PROGRESS', 'CLOSED'])

export const adminBulkUpdateRequestSchema = z.discriminatedUnion('resource', [
  z.object({ resource: z.literal('LEAD'), ids: z.array(uuid).min(1).max(100), status: leadBulkStatusSchema }).strict(),
  z.object({ resource: z.literal('CONTENT'), ids: z.array(uuid).min(1).max(100), status: publicationBulkStatusSchema }).strict(),
  z.object({ resource: z.literal('PRODUCT'), ids: z.array(uuid).min(1).max(100), status: publicationBulkStatusSchema }).strict(),
  z.object({ resource: z.literal('JOB'), ids: z.array(uuid).min(1).max(100), status: publicationBulkStatusSchema }).strict(),
])
export type AdminBulkUpdateRequest = z.infer<typeof adminBulkUpdateRequestSchema>

export const adminBulkUpdateResponseSchema = z.object({ updated: z.number().int().nonnegative() }).strict()
