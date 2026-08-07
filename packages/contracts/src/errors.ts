import { z } from 'zod'

export const apiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'CUSTOMER_BLOCKED',
  'CUSTOMER_NOT_REGISTERED',
  'CODE_EXPIRED',
  'CODE_INVALID',
  'LOYALTY_UNAVAILABLE',
  'TOO_MANY_ATTEMPTS',
  'TOO_MANY_REQUESTS',
  'VALIDATION_ERROR',
  'SERVICE_UNAVAILABLE',
  'UPSTREAM_ERROR',
  'INTERNAL_ERROR',
])

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>
