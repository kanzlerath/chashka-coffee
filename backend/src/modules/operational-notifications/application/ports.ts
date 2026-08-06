import type {
  CreateTelegramRecipientRequest,
  OperationalNotificationEvent,
  TelegramCandidate,
  TelegramRecipient,
  UpdateTelegramRecipientRequest,
} from '@chashka-coffee/contracts'

export type TelegramRecipientRepository = {
  list(): Promise<TelegramRecipient[]>
  listActiveFor(event: OperationalNotificationEvent): Promise<TelegramRecipient[]>
  findById(id: string): Promise<TelegramRecipient | null>
  findByChatId(chatId: string): Promise<TelegramRecipient | null>
  create(input: CreateTelegramRecipientRequest): Promise<TelegramRecipient>
  update(id: string, input: UpdateTelegramRecipientRequest): Promise<TelegramRecipient | null>
  remove(id: string): Promise<boolean>
  markSent(id: string, sentAt: Date): Promise<void>
  markFailed(id: string, message: string): Promise<void>
}

export type TelegramGateway = {
  listCandidates(): Promise<TelegramCandidate[]>
  sendMessage(chatId: string, text: string): Promise<void>
}
