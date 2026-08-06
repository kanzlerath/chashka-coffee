import { z } from 'zod'

const uuid = z.uuid()

export const operationalNotificationEventSchema = z.enum([
  'COFFEE_ORDER',
  'CAKE_REQUEST',
  'FOOTER_INQUIRY',
  'CONTACT_REQUEST',
  'RESERVATION_REQUEST',
  'BANQUET_REQUEST',
  'FRANCHISE_REQUEST',
  'JOB_APPLICATION',
  'JOB_GENERAL_INQUIRY',
  'EVENT_REGISTRATION',
])
export type OperationalNotificationEvent = z.infer<typeof operationalNotificationEventSchema>

export const telegramChatIdSchema = z.string().regex(/^-?\d{1,20}$/)

export const telegramRecipientSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(120),
  chatId: telegramChatIdSchema,
  username: z.string().trim().min(1).max(64).nullable(),
  eventTypes: z.array(operationalNotificationEventSchema).min(1),
  isActive: z.boolean(),
  lastSentAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()
export type TelegramRecipient = z.infer<typeof telegramRecipientSchema>

export const telegramCandidateSchema = z.object({
  chatId: telegramChatIdSchema,
  name: z.string().trim().min(1).max(120),
  username: z.string().trim().min(1).max(64).nullable(),
}).strict()
export type TelegramCandidate = z.infer<typeof telegramCandidateSchema>

export const telegramSettingsResponseSchema = z.object({
  configured: z.boolean(),
  botUsername: z.string().trim().min(1).max(64).nullable(),
  recipients: z.array(telegramRecipientSchema),
}).strict()

export const telegramCandidatesResponseSchema = z.object({
  candidates: z.array(telegramCandidateSchema),
}).strict()

export const createTelegramRecipientRequestSchema = z.object({
  chatId: telegramChatIdSchema,
  name: z.string().trim().min(1).max(120),
  username: z.string().trim().min(1).max(64).nullable(),
  eventTypes: z.array(operationalNotificationEventSchema).min(1),
}).strict()
export type CreateTelegramRecipientRequest = z.infer<typeof createTelegramRecipientRequestSchema>

export const updateTelegramRecipientRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  eventTypes: z.array(operationalNotificationEventSchema).min(1),
  isActive: z.boolean(),
}).strict()
export type UpdateTelegramRecipientRequest = z.infer<typeof updateTelegramRecipientRequestSchema>

export const telegramRecipientResponseSchema = z.object({ recipient: telegramRecipientSchema }).strict()
export const deleteTelegramRecipientResponseSchema = z.object({ deleted: z.literal(true) }).strict()
export const testTelegramRecipientResponseSchema = z.object({ sent: z.literal(true) }).strict()
