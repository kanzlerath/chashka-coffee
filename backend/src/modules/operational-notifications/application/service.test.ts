import { describe, expect, test } from 'bun:test'
import type { Lead, OperationalNotificationEvent, TelegramRecipient } from '@chashka-coffee/contracts'

import type { TelegramGateway, TelegramRecipientRepository } from './ports'
import { OperationalNotificationService } from './service'

describe('OperationalNotificationService', () => {
  test('sends only the matching lead event and records successful delivery', async () => {
    const repository = fakeRepository()
    const sent: Array<{ chatId: string; text: string }> = []
    const service = createService(repository, { listCandidates: async () => [], sendMessage: async (chatId, text) => { sent.push({ chatId, text }) } })

    await service.notifyLead(jobLead())

    expect(repository.requestedEvents).toEqual(['JOB_APPLICATION'])
    expect(sent).toHaveLength(1)
    expect(sent[0]?.text).toContain('Новый отклик')
    expect(repository.sent).toEqual(['recipient-1'])
  })

  test('routes the footer form separately from the contacts page', async () => {
    const repository = fakeRepository()
    const service = createService(repository, { listCandidates: async () => [], sendMessage: async () => {} })

    await service.notifyLead({ ...jobLead(), type: 'CONTACT', metadata: { source: 'footer_question_idea' } })
    await service.notifyLead({ ...jobLead(), type: 'CONTACT', metadata: null })

    expect(repository.requestedEvents).toEqual(['FOOTER_INQUIRY', 'CONTACT_REQUEST'])
  })

  test('maps every public lead form to an explicit event', async () => {
    const repository = fakeRepository()
    const service = createService(repository, { listCandidates: async () => [], sendMessage: async () => {} })

    for (const type of ['RESERVATION', 'BANQUET', 'FRANCHISE', 'CAKE', 'EVENT_REGISTRATION'] as const) {
      await service.notifyLead({ ...jobLead(), type })
    }
    await service.notifyLead({ ...jobLead(), metadata: { source: 'jobs_general_contact' } })

    expect(repository.requestedEvents).toEqual([
      'RESERVATION_REQUEST', 'BANQUET_REQUEST', 'FRANCHISE_REQUEST', 'CAKE_REQUEST', 'EVENT_REGISTRATION', 'JOB_GENERAL_INQUIRY',
    ])
  })

  test('records Telegram failures without rejecting the source event', async () => {
    const repository = fakeRepository()
    const service = createService(repository, { listCandidates: async () => [], sendMessage: async () => { throw new Error('bot blocked') } })

    await expect(service.notifyLead(jobLead())).resolves.toBeUndefined()
    expect(repository.failed).toEqual([{ id: 'recipient-1', message: 'bot blocked' }])
  })
})

function createService(repository: ReturnType<typeof fakeRepository>, gateway: TelegramGateway) {
  return new OperationalNotificationService({ repository, gateway, botUsername: 'chashka_bot', now: () => new Date('2026-08-06T10:00:00.000Z') })
}

function fakeRepository() {
  const recipient: TelegramRecipient = {
    id: 'recipient-1', name: 'Анна', chatId: '123', username: 'anna', eventTypes: ['JOB_APPLICATION'], isActive: true,
    lastSentAt: null, lastError: null, createdAt: '2026-08-06T09:00:00.000Z', updatedAt: '2026-08-06T09:00:00.000Z',
  }
  const requestedEvents: OperationalNotificationEvent[] = []
  const sent: string[] = []
  const failed: Array<{ id: string; message: string }> = []
  const repository: TelegramRecipientRepository & { requestedEvents: OperationalNotificationEvent[]; sent: string[]; failed: Array<{ id: string; message: string }> } = {
    requestedEvents, sent, failed,
    async list() { return [recipient] },
    async listActiveFor(event) { requestedEvents.push(event); return recipient.eventTypes.includes(event) ? [recipient] : [] },
    async findById() { return recipient },
    async findByChatId() { return null },
    async create() { return recipient },
    async update() { return recipient },
    async remove() { return true },
    async markSent(id) { sent.push(id) },
    async markFailed(id, message) { failed.push({ id, message }) },
  }
  return repository
}

function jobLead(): Lead {
  return {
    id: '019fc12b-7054-70f1-9dc6-10bedb281931', type: 'JOB', status: 'NEW', name: 'Иван', phone: '+7 999 000-00-00', email: null,
    message: 'Хочу в команду', metadata: { vacancy: 'Бариста' }, createdAt: '2026-08-06T10:00:00.000Z', updatedAt: '2026-08-06T10:00:00.000Z',
  }
}
