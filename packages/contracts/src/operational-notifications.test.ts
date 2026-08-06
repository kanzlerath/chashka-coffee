import { describe, expect, test } from 'bun:test'

import {
  createTelegramRecipientRequestSchema,
  operationalNotificationEventSchema,
  updateTelegramRecipientRequestSchema,
} from './operational-notifications'

describe('operational notification contracts', () => {
  test('accepts a Telegram recipient with selected event types', () => {
    expect(createTelegramRecipientRequestSchema.parse({
      chatId: '123456789',
      name: 'Анна, кофейня на Ленина',
      username: 'anna_coffee',
      eventTypes: ['COFFEE_ORDER', 'CAKE_REQUEST'],
    }).eventTypes).toEqual(['COFFEE_ORDER', 'CAKE_REQUEST'])
  })

  test('does not allow an empty subscription or an arbitrary event', () => {
    expect(() => updateTelegramRecipientRequestSchema.parse({ name: 'Анна', eventTypes: [], isActive: true })).toThrow()
    expect(() => operationalNotificationEventSchema.parse('EVERYTHING')).toThrow()
  })

  test('exposes an explicit event for every public form flow', () => {
    expect(operationalNotificationEventSchema.options).toEqual([
      'COFFEE_ORDER', 'CAKE_REQUEST', 'FOOTER_INQUIRY', 'CONTACT_REQUEST', 'RESERVATION_REQUEST',
      'BANQUET_REQUEST', 'FRANCHISE_REQUEST', 'JOB_APPLICATION', 'JOB_GENERAL_INQUIRY', 'EVENT_REGISTRATION',
    ])
  })

  test('rejects usernames in place of the numeric Telegram chat id', () => {
    expect(() => createTelegramRecipientRequestSchema.parse({
      chatId: '@anna',
      name: 'Анна',
      username: null,
      eventTypes: ['COFFEE_ORDER'],
    })).toThrow()
  })
})
