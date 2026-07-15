import { z } from 'zod'

const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const nullableText = (max: number) => z.string().trim().max(max).nullable()

export const jobOpeningSchema = z.object({
  id: z.uuid(), slug, title: z.string().trim().min(1).max(180), department: nullableText(120), location: nullableText(180), employmentType: nullableText(80), description: nullableText(12_000), isPublished: z.boolean(), position: z.number().int().nonnegative(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
})
export type JobOpening = z.infer<typeof jobOpeningSchema>
export const upsertJobOpeningRequestSchema = jobOpeningSchema.omit({ id: true, createdAt: true, updatedAt: true }).strict()
export type UpsertJobOpeningRequest = z.infer<typeof upsertJobOpeningRequestSchema>
export const jobOpeningListResponseSchema = z.object({ openings: z.array(jobOpeningSchema) })
export const jobOpeningResponseSchema = z.object({ opening: jobOpeningSchema })
