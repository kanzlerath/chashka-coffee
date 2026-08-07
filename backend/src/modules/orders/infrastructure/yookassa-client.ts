import { z } from 'zod'

import type { FiscalReceiptItem, YooKassaGateway, YooKassaPayment } from '../application/payment-ports'
import { PaymentFailure } from '../domain/payment-errors'

const apiBaseUrl = 'https://api.yookassa.ru/v3'

const paymentResponseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'succeeded', 'canceled']),
  amount: z.object({ value: z.string(), currency: z.literal('RUB') }),
  confirmation: z.object({ confirmation_url: z.url() }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  test: z.boolean(),
  receipt_registration: z.string().optional(),
}).passthrough()

const receiptResponseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'succeeded', 'canceled']),
}).passthrough()

export function createYooKassaGateway({
  shopId,
  secretKey,
  fetch: fetchImpl = fetch,
}: {
  shopId: string
  secretKey: string
  fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
}): YooKassaGateway {
  const authorization = `Basic ${btoa(`${shopId}:${secretKey}`)}`

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetchImpl(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new PaymentFailure(
        'payment_not_available',
        `YooKassa request failed with HTTP ${response.status}.`,
        { status: response.status },
      )
    }
    return payload
  }

  return {
    async createPayment(input, idempotencyKey) {
      const payload = await request('/payments', {
        method: 'POST',
        headers: { 'Idempotence-Key': idempotencyKey },
        body: JSON.stringify({
          amount: money(input.amountKopecks),
          capture: true,
          confirmation: { type: 'redirect', return_url: input.returnUrl },
          description: `Заказ ${input.publicNumber}`.slice(0, 128),
          metadata: { order_id: input.orderId },
          receipt: receipt(input.customerEmail, input.items),
        }),
      })
      return toPayment(paymentResponseSchema.parse(payload))
    },

    async getPayment(id) {
      return toPayment(paymentResponseSchema.parse(await request(`/payments/${encodeURIComponent(id)}`)))
    },

    async createClosingReceipt(input, idempotencyKey) {
      const payload = await request('/receipts', {
        method: 'POST',
        headers: { 'Idempotence-Key': idempotencyKey },
        body: JSON.stringify({
          customer: { email: input.customerEmail },
          payment_id: input.paymentId,
          type: 'payment',
          send: true,
          items: input.items.map(receiptItem),
          internet: true,
          settlements: [{ type: input.settlementType, amount: money(input.amountKopecks) }],
        }),
      })
      return receiptResponseSchema.parse(payload)
    },
  }
}

function receipt(customerEmail: string, items: FiscalReceiptItem[]) {
  return {
    customer: { email: customerEmail },
    items: items.map(receiptItem),
    internet: true,
  }
}

function receiptItem(item: FiscalReceiptItem) {
  return {
    description: item.description,
    quantity: item.quantity,
    amount: money(item.amountKopecks),
    vat_code: item.vatCode,
    payment_mode: item.paymentMode,
    payment_subject: item.paymentSubject,
    measure: item.measure,
  }
}

function money(kopecks: number) {
  return { value: (kopecks / 100).toFixed(2), currency: 'RUB' as const }
}

function toPayment(input: z.infer<typeof paymentResponseSchema>): YooKassaPayment {
  return {
    id: input.id,
    status: input.status,
    amountKopecks: parseKopecks(input.amount.value),
    currency: input.amount.currency,
    confirmationUrl: input.confirmation?.confirmation_url ?? null,
    metadataOrderId: typeof input.metadata?.order_id === 'string' ? input.metadata.order_id : null,
    test: input.test,
    receiptRegistration: input.receipt_registration ?? null,
  }
}

function parseKopecks(value: string) {
  if (!/^\d+\.\d{2}$/.test(value)) {
    throw new PaymentFailure('payment_verification_failed', 'YooKassa returned an invalid money value.')
  }
  const [rubles, kopecks] = value.split('.') as [string, string]
  return Number(rubles) * 100 + Number(kopecks)
}
