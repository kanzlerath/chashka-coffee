import { describe, expect, test } from 'bun:test'

import { CustomerAccountApiError, createCustomerAccountApi } from '../src/lib/customer-account-api'

const profile = {
  id: '019fc12b-7054-70f1-9dc6-10bedb28192e',
  phone: '79131234567',
  name: 'Анна',
  surname: 'Иванова',
  middleName: null,
  email: null,
  cardNumber: '123456',
  balance: 725.5,
}
const orderId = '019fc12b-7054-70f1-9dc6-10bedb281936'
const accountOrder = {
  id: orderId,
  publicNumber: 'CK-260811-A1B2C3',
  status: 'AWAITING_PAYMENT',
  paymentStatus: 'PENDING',
  customer: { name: 'Анна', phone: '79131234567', email: 'anna@example.com' },
  pickupLocation: { id: null, slug: 'center', name: 'Центр', city: 'Новосибирск', address: 'Красный проспект, 25', phone: '+7 383 000-00-00', openingHoursLabel: 'Ежедневно' },
  items: [{ id: '019fc12b-7054-70f1-9dc6-10bedb281937', variantId: null, productName: 'Эфиопия Гуджи', variantLabel: '250 г', imageUrl: null, unitPriceKopecks: 89000, quantity: 1, totalKopecks: 89000 }],
  itemCount: 1,
  totalKopecks: 89000,
  comment: null,
  createdAt: '2026-08-11T10:00:00.000Z',
  updatedAt: '2026-08-11T10:00:00.000Z',
}

describe('customer account browser API', () => {
  test('deduplicates simultaneous profile reads on pages that also render the shared header', async () => {
    let calls = 0
    const api = createCustomerAccountApi({
      apiOrigin: 'https://api.chashka.test',
      fetch: async () => {
        calls += 1
        await Promise.resolve()
        return Response.json({ customer: profile })
      },
    })

    await expect(Promise.all([api.getProfile(), api.getProfile()])).resolves.toEqual([profile, profile])
    expect(calls).toBe(1)
  })

  test('uses cookie credentials and keeps the login challenge explicit', async () => {
    const requests: Request[] = []
    const api = createCustomerAccountApi({
      apiOrigin: 'https://api.example.com',
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({
          challengeId: '019fc12b-7054-70f1-9dc6-10bedb28192e',
          expiresAt: '2026-08-02T07:10:00.000Z',
        }, { status: 202 })
      },
    })

    await api.sendCode('+7 (913) 123-45-67')
    expect(requests[0].credentials).toBe('include')
    expect(requests[0].url).toBe('https://api.example.com/api/customer/auth/code')
    expect(await requests[0].json()).toEqual({ phone: '79131234567' })
  })

  test('treats an expired session as signed out without hiding other errors', async () => {
    const signedOutApi = createCustomerAccountApi({
      fetch: async () => Response.json({ error: { code: 'UNAUTHORIZED', message: 'Войдите' } }, { status: 401 }),
    })
    await expect(signedOutApi.getProfile()).resolves.toBeNull()

    const unavailableApi = createCustomerAccountApi({
      fetch: async () => Response.json({ error: { code: 'LOYALTY_UNAVAILABLE', message: 'Сервис недоступен' } }, { status: 503 }),
    })
    await expect(unavailableApi.getProfile()).rejects.toBeInstanceOf(CustomerAccountApiError)
    await expect(unavailableApi.getProfile()).rejects.toMatchObject({
      code: 'LOYALTY_UNAVAILABLE',
      message: 'Сервис недоступен',
    })
  })

  test('opens and resumes an order through the authenticated account path', async () => {
    const requests: Request[] = []
    const api = createCustomerAccountApi({
      apiOrigin: 'https://api.chashka.test',
      fetch: async (input, init) => {
        const request = new Request(input, init)
        requests.push(request)
        return request.method === 'POST'
          ? Response.json({ order: accountOrder, payment: { status: 'PENDING', confirmationUrl: 'https://yookassa.test/confirm' } })
          : Response.json({ order: accountOrder })
      },
    })

    await expect(api.getOrder(orderId)).resolves.toEqual({ order: accountOrder })
    await expect(api.startOrderPayment(orderId)).resolves.toMatchObject({ order: accountOrder })
    expect(requests.map((request) => [request.method, request.url, request.credentials])).toEqual([
      ['GET', `https://api.chashka.test/api/customer/orders/${orderId}`, 'include'],
      ['POST', `https://api.chashka.test/api/customer/orders/${orderId}/payment`, 'include'],
    ])
  })
})
