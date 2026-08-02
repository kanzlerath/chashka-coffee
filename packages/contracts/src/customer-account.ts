import { z } from 'zod'

export const customerPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ''))
  .transform((value) => value.length === 10 ? `7${value}` : value.startsWith('8') && value.length === 11 ? `7${value.slice(1)}` : value)
  .pipe(z.string().regex(/^7\d{10}$/, 'Укажите российский номер телефона'))

export const customerSendCodeRequestSchema = z.object({
  phone: customerPhoneSchema,
}).strict()

export const customerSendCodeResponseSchema = z.object({
  challengeId: z.string().uuid(),
  expiresAt: z.string().datetime(),
}).strict()

export const customerVerifyCodeRequestSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{3,8}$/, 'Введите код из SMS'),
}).strict()

export const customerProfileSchema = z.object({
  id: z.string().uuid(),
  phone: customerPhoneSchema,
  name: z.string().nullable(),
  surname: z.string().nullable(),
  middleName: z.string().nullable(),
  email: z.string().email().nullable(),
  cardNumber: z.string().nullable(),
  balance: z.number().finite(),
}).strict()

export const customerSessionResponseSchema = z.object({
  customer: customerProfileSchema,
}).strict()

export const customerQrResponseSchema = z.object({
  value: z.string().min(1),
  generatedAt: z.string().datetime(),
}).strict()

export const customerLogoutRequestSchema = z.object({}).strict().optional().default({})

export type CustomerSendCodeRequest = z.infer<typeof customerSendCodeRequestSchema>
export type CustomerSendCodeResponse = z.infer<typeof customerSendCodeResponseSchema>
export type CustomerVerifyCodeRequest = z.infer<typeof customerVerifyCodeRequestSchema>
export type CustomerProfile = z.infer<typeof customerProfileSchema>
export type CustomerSessionResponse = z.infer<typeof customerSessionResponseSchema>
export type CustomerQrResponse = z.infer<typeof customerQrResponseSchema>

