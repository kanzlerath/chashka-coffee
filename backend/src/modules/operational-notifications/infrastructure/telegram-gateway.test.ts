import { describe, expect, test } from 'bun:test'

import { createTelegramGateway } from './telegram-gateway'

describe('Telegram gateway', () => {
  test('discovers unique private human chats from recent updates', async () => {
    const gateway = createTelegramGateway('token', async () => jsonResponse({ ok: true, result: [
      { update_id: 1, message: { chat: { id: 101, type: 'private', first_name: 'Анна', username: 'anna' }, from: { id: 101, first_name: 'Анна', username: 'anna' } } },
      { update_id: 2, message: { chat: { id: 101, type: 'private', first_name: 'Анна', username: 'anna' }, from: { id: 101, first_name: 'Анна', username: 'anna' } } },
      { update_id: 3, message: { chat: { id: -10, type: 'group', first_name: 'Команда' }, from: { id: 102, first_name: 'Иван' } } },
    ] }))

    await expect(gateway.listCandidates()).resolves.toEqual([{ chatId: '101', name: 'Анна', username: 'anna' }])
  })

  test('surfaces Telegram API descriptions for delivery diagnostics', async () => {
    const gateway = createTelegramGateway('token', async () => jsonResponse({ ok: false, description: 'Forbidden: bot was blocked by the user' }, 403))

    await expect(gateway.sendMessage('101', 'test')).rejects.toThrow('bot was blocked')
  })
})

function jsonResponse(payload: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }))
}
