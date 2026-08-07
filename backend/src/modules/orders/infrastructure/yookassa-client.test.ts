import { describe, expect, test } from 'bun:test'

import { createYooKassaGateway } from './yookassa-client'

describe('YooKassa gateway', () => {
  test('creates a one-stage redirect payment with fiscal receipt data', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = []
    const gateway = createYooKassaGateway({
      shopId: '123456',
      secretKey: 'test_secret',
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init! })
        return Response.json({
          id: '2f66dbf0-000f-5000-9000-1d1234567890',
          status: 'pending',
          amount: { value: '890.00', currency: 'RUB' },
          confirmation: { type: 'redirect', confirmation_url: 'https://yookassa.test/confirm' },
          metadata: { order_id: 'order-id' },
          test: true,
        })
      },
    })

    await gateway.createPayment({
      orderId: 'order-id',
      publicNumber: 'CK-1',
      amountKopecks: 89_000,
      returnUrl: 'https://dev.example.com/order?token=private',
      customerEmail: 'anna@example.com',
      items: [{ description: 'Кофе — 250 г', quantity: 1, amountKopecks: 89_000, vatCode: 1, paymentMode: 'full_prepayment', paymentSubject: 'commodity', measure: 'piece' }],
    }, 'idempotency-key')

    expect(requests).toHaveLength(1)
    expect(requests[0]!.url).toBe('https://api.yookassa.ru/v3/payments')
    expect(new Headers(requests[0]!.init.headers).get('Idempotence-Key')).toBe('idempotency-key')
    expect(new Headers(requests[0]!.init.headers).get('Authorization')).toBe(`Basic ${btoa('123456:test_secret')}`)
    expect(JSON.parse(String(requests[0]!.init.body))).toEqual({
      amount: { value: '890.00', currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: 'https://dev.example.com/order?token=private' },
      description: 'Заказ CK-1',
      metadata: { order_id: 'order-id' },
      receipt: {
        customer: { email: 'anna@example.com' },
        items: [{ description: 'Кофе — 250 г', quantity: 1, amount: { value: '890.00', currency: 'RUB' }, vat_code: 1, payment_mode: 'full_prepayment', payment_subject: 'commodity', measure: 'piece' }],
        internet: true,
      },
    })
  })

  test('sends the closing receipt with prepayment settlement', async () => {
    let body: unknown
    const gateway = createYooKassaGateway({
      shopId: '123456',
      secretKey: 'test_secret',
      fetch: async (_url, init) => {
        body = JSON.parse(String(init?.body))
        return Response.json({ id: 'rt_test', status: 'pending' })
      },
    })

    await gateway.createClosingReceipt({
      orderId: 'order-id',
      paymentId: 'payment-id',
      customerEmail: 'anna@example.com',
      amountKopecks: 89_000,
      settlementType: 'prepayment',
      items: [{ description: 'Кофе — 250 г', quantity: 1, amountKopecks: 89_000, vatCode: 1, paymentMode: 'full_payment', paymentSubject: 'commodity', measure: 'piece' }],
    }, 'receipt-key')

    expect(body).toMatchObject({
      payment_id: 'payment-id',
      type: 'payment',
      send: true,
      settlements: [{ type: 'prepayment', amount: { value: '890.00', currency: 'RUB' } }],
      items: [{ payment_mode: 'full_payment', vat_code: 1 }],
    })
  })
})
