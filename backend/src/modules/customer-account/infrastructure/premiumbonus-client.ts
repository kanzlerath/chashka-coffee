import { customerPhoneSchema } from '@chashka-coffee/contracts'
import { z } from 'zod'

import type { LoyaltyCustomer, PremiumBonusGateway } from '../application/ports'
import { CustomerAccountFailure } from '../domain/errors'

const providerBaseResponseSchema = z.object({
  success: z.boolean(),
  error_description: z.string().optional(),
}).passthrough()

const buyerInfoResponseSchema = providerBaseResponseSchema.extend({
  is_registered: z.boolean().default(false),
  blocked: z.boolean().default(false),
  client_id: z.union([z.string(), z.number()]).nullish(),
  phone: z.string().optional(),
  name: z.string().nullish(),
  surname: z.string().nullish(),
  middle_name: z.string().nullish(),
  email: z.string().nullish(),
  card_number: z.union([z.string(), z.number()]).nullish(),
  balance: z.coerce.number().finite().default(0),
})

const orderCodeResponseSchema = providerBaseResponseSchema.extend({
  order_code: z.union([z.string(), z.number()]),
})

type PremiumBonusGatewayOptions = {
  apiToken: string
  baseUrl: string
  fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
}

export function createPremiumBonusGateway({
  apiToken,
  baseUrl,
  fetch: fetchImplementation = (input, init) => fetch(input, init),
}: PremiumBonusGatewayOptions): PremiumBonusGateway {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  async function post(path: string, body: unknown, purpose: 'verify' | 'general') {
    let response: Response
    try {
      response = await fetchImplementation(new URL(path.replace(/^\//, ''), normalizedBaseUrl), {
        method: 'POST',
        headers: {
          Authorization: apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      })
    } catch {
      throw new CustomerAccountFailure('loyalty_unavailable', 'PremiumBonus временно недоступен')
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new CustomerAccountFailure('loyalty_unavailable', 'PremiumBonus вернул некорректный ответ')
    }

    const baseResult = providerBaseResponseSchema.safeParse(payload)
    if (response.status === 429) {
      throw new CustomerAccountFailure('too_many_requests', 'Слишком много запросов. Попробуйте позже')
    }
    if (!response.ok || !baseResult.success || !baseResult.data.success) {
      if (purpose === 'verify' && response.status < 500) {
        throw new CustomerAccountFailure('code_invalid', 'Неверный код из SMS')
      }
      throw new CustomerAccountFailure('loyalty_unavailable', 'PremiumBonus не выполнил запрос')
    }

    return payload
  }

  return {
    async getCustomer(phone): Promise<LoyaltyCustomer> {
      const payload = await post('/buyer-info', { identificator: phone }, 'general')
      const result = buyerInfoResponseSchema.safeParse(payload)
      if (!result.success) {
        throw new CustomerAccountFailure('loyalty_unavailable', 'PremiumBonus вернул профиль неизвестного формата')
      }
      return {
        registered: result.data.is_registered,
        blocked: result.data.blocked,
        clientId: result.data.client_id == null ? null : String(result.data.client_id),
        phone: normalizePhone(result.data.phone, phone),
        name: normalizeNullable(result.data.name),
        surname: normalizeNullable(result.data.surname),
        middleName: normalizeNullable(result.data.middle_name),
        email: normalizeEmail(result.data.email),
        cardNumber: result.data.card_number == null ? null : String(result.data.card_number),
        balance: result.data.balance,
      }
    },

    async sendLoginCode(phone) {
      await post('/send-custom-code', {
        phone,
        text: 'Код для входа в «Чашку кофе»: {{code}}',
      }, 'general')
    },

    async verifyLoginCode(phone, code) {
      await post('/verify-custom-code', { phone, code }, 'verify')
    },

    async generateOrderCode(phone) {
      const payload = await post('/generate-order-code', { phone }, 'general')
      const result = orderCodeResponseSchema.safeParse(payload)
      if (!result.success) {
        throw new CustomerAccountFailure('loyalty_unavailable', 'PremiumBonus не вернул код покупателя')
      }
      return String(result.data.order_code)
    },
  }
}

function normalizeNullable(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = normalizeNullable(value)
  if (!normalized || !z.string().email().safeParse(normalized).success) return null
  return normalized
}

function normalizePhone(providerPhone: string | undefined, fallbackPhone: string) {
  const normalized = customerPhoneSchema.safeParse(providerPhone ?? fallbackPhone)
  return normalized.success ? normalized.data : fallbackPhone
}
