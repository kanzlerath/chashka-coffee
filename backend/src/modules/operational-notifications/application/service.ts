import type {
  CreateTelegramRecipientRequest,
  Lead,
  OperationalNotificationEvent,
  Order,
  UpdateTelegramRecipientRequest,
} from '@chashka-coffee/contracts'
import { FOOTER_QUESTION_LEAD_SOURCE, JOB_GENERAL_LEAD_SOURCE } from '@chashka-coffee/contracts'

import type { TelegramGateway, TelegramRecipientRepository } from './ports'

export class OperationalNotificationFailure extends Error {
  constructor(readonly reason: 'not_configured' | 'not_found' | 'duplicate' | 'delivery_failed', message: string) {
    super(message)
  }
}

export class OperationalNotificationService {
  constructor(private readonly dependencies: {
    repository: TelegramRecipientRepository
    gateway: TelegramGateway | null
    botUsername: string | null
    now: () => Date
  }) {}

  async getSettings() {
    return {
      configured: this.dependencies.gateway !== null,
      botUsername: this.dependencies.botUsername,
      recipients: await this.dependencies.repository.list(),
    }
  }

  async listCandidates() {
    return this.gateway().listCandidates()
  }

  async createRecipient(input: CreateTelegramRecipientRequest) {
    if (await this.dependencies.repository.findByChatId(input.chatId)) {
      throw new OperationalNotificationFailure('duplicate', 'Этот Telegram-аккаунт уже подключён.')
    }
    return this.dependencies.repository.create(input)
  }

  async updateRecipient(id: string, input: UpdateTelegramRecipientRequest) {
    const recipient = await this.dependencies.repository.update(id, input)
    if (!recipient) throw new OperationalNotificationFailure('not_found', 'Получатель не найден.')
    return recipient
  }

  async removeRecipient(id: string) {
    if (!await this.dependencies.repository.remove(id)) {
      throw new OperationalNotificationFailure('not_found', 'Получатель не найден.')
    }
  }

  async sendTest(id: string) {
    const recipient = await this.dependencies.repository.findById(id)
    if (!recipient) throw new OperationalNotificationFailure('not_found', 'Получатель не найден.')
    try {
      await this.gateway().sendMessage(recipient.chatId, '✅ Тестовое уведомление\n\nTelegram подключён к админке «Чашка кофе».')
      await this.dependencies.repository.markSent(recipient.id, this.dependencies.now())
    } catch (error) {
      const message = deliveryErrorMessage(error)
      await this.dependencies.repository.markFailed(recipient.id, message)
      throw new OperationalNotificationFailure('delivery_failed', message)
    }
  }

  async notifyOrder(order: Order) {
    await this.deliver('COFFEE_ORDER', formatOrder(order))
  }

  async notifyLead(lead: Lead) {
    const event = eventForLead(lead)
    await this.deliver(event, formatLead(lead, event))
  }

  private async deliver(event: OperationalNotificationEvent, text: string) {
    if (!this.dependencies.gateway) return
    try {
      const recipients = await this.dependencies.repository.listActiveFor(event)
      await Promise.all(recipients.map(async (recipient) => {
        try {
          await this.dependencies.gateway!.sendMessage(recipient.chatId, text)
          await this.dependencies.repository.markSent(recipient.id, this.dependencies.now())
        } catch (error) {
          await this.dependencies.repository.markFailed(recipient.id, deliveryErrorMessage(error))
        }
      }))
    } catch {
      // An external notification must never turn a successfully accepted order or lead into an error.
    }
  }

  private gateway() {
    if (!this.dependencies.gateway) {
      throw new OperationalNotificationFailure('not_configured', 'Telegram-бот ещё не настроен на сервере.')
    }
    return this.dependencies.gateway
  }
}

function formatOrder(order: Order) {
  const items = order.items.map((item) => `• ${item.productName}, ${item.variantLabel} × ${item.quantity}`).join('\n')
  return [
    `☕ Новый заказ кофе ${order.publicNumber}`,
    '',
    `${order.customer.name} · ${order.customer.phone}`,
    `${order.pickupLocation.name}, ${order.pickupLocation.address}`,
    '',
    items,
    `Итого: ${(order.totalKopecks / 100).toLocaleString('ru-RU')} ₽`,
    ...(order.comment ? ['', `Комментарий: ${order.comment}`] : []),
  ].join('\n')
}

function eventForLead(lead: Lead): Exclude<OperationalNotificationEvent, 'COFFEE_ORDER'> {
  switch (lead.type) {
    case 'CONTACT': return lead.metadata?.source === FOOTER_QUESTION_LEAD_SOURCE ? 'FOOTER_INQUIRY' : 'CONTACT_REQUEST'
    case 'RESERVATION': return 'RESERVATION_REQUEST'
    case 'BANQUET': return 'BANQUET_REQUEST'
    case 'FRANCHISE': return 'FRANCHISE_REQUEST'
    case 'CAKE': return 'CAKE_REQUEST'
    case 'JOB': return lead.metadata?.source === JOB_GENERAL_LEAD_SOURCE ? 'JOB_GENERAL_INQUIRY' : 'JOB_APPLICATION'
    case 'EVENT_REGISTRATION': return 'EVENT_REGISTRATION'
  }
}

function formatLead(lead: Lead, event: Exclude<OperationalNotificationEvent, 'COFFEE_ORDER'>) {
  const title = leadNotificationTitles[event]
  const metadata = Object.entries(lead.metadata ?? {})
    .filter(([key]) => key !== 'source')
    .map(([key, value]) => `${metadataLabels[key] ?? key}: ${value}`)
  return [
    title,
    '',
    lead.name,
    [lead.phone, lead.email].filter(Boolean).join(' · '),
    ...metadata,
    ...(lead.message ? ['', lead.message] : []),
  ].filter(Boolean).join('\n')
}

const leadNotificationTitles: Record<Exclude<OperationalNotificationEvent, 'COFFEE_ORDER'>, string> = {
  CAKE_REQUEST: '🎂 Новая заявка в кондитерскую',
  FOOTER_INQUIRY: '💬 Новый вопрос или идея с сайта',
  CONTACT_REQUEST: '✉️ Новое обращение со страницы контактов',
  RESERVATION_REQUEST: '🪑 Новая заявка на бронирование',
  BANQUET_REQUEST: '🥂 Новая заявка на банкет',
  FRANCHISE_REQUEST: '📍 Новая заявка по франшизе',
  JOB_APPLICATION: '💼 Новый отклик на вакансию',
  JOB_GENERAL_INQUIRY: '👋 Новое общее обращение о работе',
  EVENT_REGISTRATION: '🎟 Новая регистрация на событие',
}

const metadataLabels: Record<string, string> = {
  vacancy: 'Вакансия', restaurant: 'Заведение', address: 'Адрес', subject: 'Тема', product: 'Торт',
}

function deliveryErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Telegram не принял сообщение.'
  return message.slice(0, 500)
}
