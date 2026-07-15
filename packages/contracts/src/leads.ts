import { z } from 'zod'

const uuid = z.uuid()
const nullableText = (max: number) => z.string().trim().max(max).nullable()
const leadMetadataSchema = z.record(z.string().trim().min(1).max(80), z.string().trim().max(1_000))

export const leadTypeSchema = z.enum(['CONTACT', 'RESERVATION', 'FRANCHISE', 'BANQUET', 'JOB'])
export const leadStatusSchema = z.enum(['NEW', 'IN_PROGRESS', 'CLOSED'])
export type LeadType = z.infer<typeof leadTypeSchema>
export type LeadStatus = z.infer<typeof leadStatusSchema>

export const createLeadRequestSchema = z.object({
  type: leadTypeSchema,
  name: z.string().trim().min(1).max(180),
  phone: nullableText(40),
  email: z.email().max(320).nullable(),
  message: nullableText(4_000),
  metadata: leadMetadataSchema.nullable().optional(),
}).strict()
export type CreateLeadRequest = z.infer<typeof createLeadRequestSchema>

export const leadSchema = z.object({
  id: uuid,
  type: leadTypeSchema,
  status: leadStatusSchema,
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  message: z.string().nullable(),
  metadata: leadMetadataSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Lead = z.infer<typeof leadSchema>

export const updateLeadStatusRequestSchema = z.object({ status: leadStatusSchema }).strict()
export const leadResponseSchema = z.object({ lead: leadSchema })
export const leadListResponseSchema = z.object({ leads: z.array(leadSchema) })
