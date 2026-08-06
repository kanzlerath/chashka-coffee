import type {
  CreateTelegramRecipientRequest,
  OperationalNotificationEvent,
  TelegramRecipient,
  UpdateTelegramRecipientRequest,
} from '@chashka-coffee/contracts'

import type { DbClient } from '../../../db'
import type { TelegramRecipientRepository } from '../application/ports'

type RecipientRecord = {
  id: string
  name: string
  chatId: string
  username: string | null
  eventTypes: OperationalNotificationEvent[]
  isActive: boolean
  lastSentAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

const dto = (recipient: RecipientRecord): TelegramRecipient => ({
  ...recipient,
  lastSentAt: recipient.lastSentAt?.toISOString() ?? null,
  createdAt: recipient.createdAt.toISOString(),
  updatedAt: recipient.updatedAt.toISOString(),
})

export function createPrismaTelegramRecipientRepository(db: DbClient): TelegramRecipientRepository {
  return {
    async list() {
      return (await db.telegramRecipient.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] })).map((item) => dto(item as RecipientRecord))
    },
    async listActiveFor(event) {
      return (await db.telegramRecipient.findMany({
        where: { isActive: true, eventTypes: { has: event } },
        orderBy: { name: 'asc' },
      })).map((item) => dto(item as RecipientRecord))
    },
    async findById(id) {
      const recipient = await db.telegramRecipient.findUnique({ where: { id } })
      return recipient ? dto(recipient as RecipientRecord) : null
    },
    async findByChatId(chatId) {
      const recipient = await db.telegramRecipient.findUnique({ where: { chatId } })
      return recipient ? dto(recipient as RecipientRecord) : null
    },
    async create(input: CreateTelegramRecipientRequest) {
      return dto(await db.telegramRecipient.create({ data: input }) as RecipientRecord)
    },
    async update(id: string, input: UpdateTelegramRecipientRequest) {
      try {
        return dto(await db.telegramRecipient.update({ where: { id }, data: input }) as RecipientRecord)
      } catch {
        return null
      }
    },
    async remove(id) {
      const result = await db.telegramRecipient.deleteMany({ where: { id } })
      return result.count > 0
    },
    async markSent(id, sentAt) {
      await db.telegramRecipient.updateMany({ where: { id }, data: { lastSentAt: sentAt, lastError: null } })
    },
    async markFailed(id, message) {
      await db.telegramRecipient.updateMany({ where: { id }, data: { lastError: message } })
    },
  }
}
