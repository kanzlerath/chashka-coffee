import {
  apiErrorSchema,
  createOrderRequestSchema,
  createOrderResponseSchema,
  orderQuoteRequestSchema,
  orderQuoteResponseSchema,
  orderResponseSchema,
  pickupLocationListResponseSchema,
  startOrderPaymentResponseSchema,
} from '@chashka-coffee/contracts'

const apiOrigin = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000'

export class StoreApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly details?: unknown) {
    super(message)
  }
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload)
    throw new StoreApiError(
      parsed.success ? parsed.data.error.code : 'REQUEST_FAILED',
      parsed.success ? parsed.data.error.message : 'Не удалось связаться с сервисом.',
      response.status,
      parsed.success ? parsed.data.error.details : undefined,
    )
  }
  return payload
}

export const storeApi = {
  async quote(lines: Array<{ variantId: string; quantity: number }>) {
    const body = orderQuoteRequestSchema.parse({ lines })
    return orderQuoteResponseSchema.parse(await request('/api/store/quote', { method: 'POST', body: JSON.stringify(body) }))
  },
  async pickupLocations() {
    return pickupLocationListResponseSchema.parse(await request('/api/store/pickup-locations'))
  },
  async createOrder(input: unknown) {
    const body = createOrderRequestSchema.parse(input)
    return createOrderResponseSchema.parse(await request('/api/store/orders', { method: 'POST', body: JSON.stringify(body) }))
  },
  async getOrder(accessToken: string) {
    return orderResponseSchema.parse(await request(`/api/store/orders/${encodeURIComponent(accessToken)}`))
  },
  async startPayment(accessToken: string) {
    return startOrderPaymentResponseSchema.parse(await request(`/api/store/orders/${encodeURIComponent(accessToken)}/payment`, { method: 'POST' }))
  },
}
