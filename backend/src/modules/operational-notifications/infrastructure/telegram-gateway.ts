import type { TelegramCandidate } from '@chashka-coffee/contracts'

import type { TelegramGateway } from '../application/ports'

type TelegramUser = { id: number; is_bot?: boolean; first_name: string; last_name?: string; username?: string }
type TelegramChat = { id: number; type: string; first_name?: string; last_name?: string; username?: string }
type TelegramUpdate = { update_id: number; message?: { chat: TelegramChat; from?: TelegramUser } }
type TelegramResponse<T> = { ok: boolean; result?: T; description?: string }
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export function createTelegramGateway(token: string, fetcher: Fetcher = fetch): TelegramGateway {
  const call = async <T>(method: string, body: Record<string, unknown>): Promise<T> => {
    const response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    })
    const payload = await response.json() as TelegramResponse<T>
    if (!response.ok || !payload.ok || payload.result === undefined) {
      throw new Error(payload.description ?? `Telegram API returned ${response.status}`)
    }
    return payload.result
  }

  return {
    async listCandidates() {
      const updates = await call<TelegramUpdate[]>('getUpdates', { limit: 100, timeout: 0, allowed_updates: ['message'] })
      const candidates = new Map<string, TelegramCandidate>()
      for (const update of updates) {
        const message = update.message
        if (!message || message.chat.type !== 'private' || message.from?.is_bot) continue
        const source = message.from ?? message.chat
        const name = [source.first_name, source.last_name].filter(Boolean).join(' ').trim()
        if (!name) continue
        candidates.set(String(message.chat.id), {
          chatId: String(message.chat.id),
          name: name.slice(0, 120),
          username: source.username?.slice(0, 64) ?? null,
        })
      }
      return [...candidates.values()]
    },
    async sendMessage(chatId, text) {
      await call('sendMessage', { chat_id: chatId, text })
    },
  }
}
