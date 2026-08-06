import { z } from 'zod'
import { publicationStatusSchema } from './content'

const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const nullableText = (max: number) => z.string().trim().max(max).nullable()

export const jobOpeningRestaurantSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(180),
  address: z.string().trim().min(1).max(300),
})
export type JobOpeningRestaurant = z.infer<typeof jobOpeningRestaurantSchema>

export const jobOpeningSchema = z.object({
  id: z.uuid(), slug, title: z.string().trim().min(1).max(180), department: nullableText(120), location: nullableText(180), employmentType: nullableText(80), description: nullableText(12_000), restaurant: jobOpeningRestaurantSchema.nullable(), status: publicationStatusSchema, publishAt: z.string().datetime().nullable().default(null), position: z.number().int().nonnegative(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
})
export type JobOpening = z.infer<typeof jobOpeningSchema>
export const upsertJobOpeningRequestSchema = jobOpeningSchema.omit({ id: true, restaurant: true, createdAt: true, updatedAt: true }).extend({ restaurantId: z.uuid().nullable() }).strict()
export type UpsertJobOpeningRequest = z.infer<typeof upsertJobOpeningRequestSchema>
export const jobOpeningListResponseSchema = z.object({ openings: z.array(jobOpeningSchema) })
export const jobOpeningResponseSchema = z.object({ opening: jobOpeningSchema })
export const jobOpeningRestaurantListResponseSchema = z.object({ restaurants: z.array(jobOpeningRestaurantSchema) })
