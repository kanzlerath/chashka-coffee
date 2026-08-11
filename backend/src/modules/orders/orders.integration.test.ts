import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import type { AppEnv } from '../../env'
import type { YooKassaGateway, YooKassaPayment } from './application/payment-ports'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('online coffee order API integration', () => {
  const yooKassa = createFakeYooKassa()
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:4321'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
    MEDIA_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
    MEDIA_VIDEO_UPLOAD_MAX_BYTES: 100 * 1024 * 1024,
    MEDIA_DOCUMENT_UPLOAD_MAX_BYTES: 20 * 1024 * 1024,
    WEBSITE_BUILD_DEBOUNCE_SECONDS: 45,
    WEBSITE_BUILD_POLL_SECONDS: 10,
    WEBSITE_BUILD_RETRY_SECONDS: 300,
    SPACES_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
    SPACES_UPLOAD_URL_TTL_SECONDS: 900,
    SPACES_DOWNLOAD_URL_TTL_SECONDS: 300,
    SPACES_PUBLIC_CACHE_CONTROL: 'public, max-age=31536000, immutable',
    YOOKASSA_SHOP_ID: 'test-shop',
    YOOKASSA_SECRET_KEY: 'test-secret',
    YOOKASSA_RETURN_URL: 'http://localhost:4321/order',
    YOOKASSA_TEST_MODE: true,
  }
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma, yooKassaGateway: yooKassa.gateway, premiumBonusGateway: {
    async getCustomer(phone) {
      return {
        registered: true,
        blocked: false,
        clientId: `premium-bonus-${phone}`,
        phone,
        name: phone === '79130000000' ? 'Мария' : 'Анна',
        surname: null,
        middleName: null,
        email: phone === '79130000000' ? 'maria@example.com' : 'anna@example.com',
        cardNumber: null,
        balance: 0,
      }
    },
    async sendLoginCode() {},
    async verifyLoginCode() {},
    async generateOrderCode() { return '123456' },
  } })
  let variantId = ''
  let restaurantId = ''

  beforeEach(async () => {
    yooKassa.reset()
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    await prisma.customerSession.deleteMany()
    await prisma.customerAccount.deleteMany()
    await prisma.customerConsent.deleteMany()
    await prisma.customerNote.deleteMany()
    await prisma.customerTagAssignment.deleteMany()
    await prisma.customerTag.deleteMany()
    await prisma.lead.updateMany({ data: { crmCustomerId: null } })
    await prisma.customerAccount.updateMany({ data: { crmCustomerId: null } })
    await prisma.customer.deleteMany()
    await prisma.productVariant.deleteMany()
    await prisma.product.deleteMany()
    await prisma.restaurantOpeningHours.deleteMany()
    await prisma.restaurant.deleteMany()

    const restaurant = await prisma.restaurant.create({
      data: {
        slug: 'pickup-center',
        name: 'Чашка кофе — Центр',
        format: 'CITY',
        area: 'CITY',
        city: 'Новосибирск',
        address: 'Красный проспект, 25',
        phone: '+7 383 000-00-00',
        latitude: 55.03,
        longitude: 82.92,
        coffeePickupEnabled: true,
        openingHours: {
          create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            dayOfWeek, opensAt: '08:00', closesAt: '22:00', isClosed: false,
          })),
        },
      },
    })
    restaurantId = restaurant.id
    const product = await prisma.product.create({
      data: {
        type: 'COFFEE',
        status: 'PUBLISHED',
        slug: 'ethiopia-guji-order',
        name: 'Эфиопия Гуджи',
        variants: { create: { label: '250 г', weightGrams: 250, priceKopecks: 89000, isAvailable: true } },
      },
      include: { variants: true },
    })
    variantId = product.variants[0]!.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('quotes, creates idempotently, and reads an order through its private token', async () => {
    const locations = await app.request('/api/store/pickup-locations')
    expect(locations.status).toBe(200)
    expect((await locations.json()).locations).toMatchObject([{ latitude: 55.03, longitude: 82.92 }])

    const quote = await app.request('/api/store/quote', json({ lines: [{ variantId, quantity: 2 }] }))
    expect(quote.status).toBe(200)
    expect(await quote.json()).toMatchObject({ itemCount: 2, totalKopecks: 178000, unavailableLines: [] })

    const input = {
      lines: [{ variantId, quantity: 2 }],
      pickupRestaurantId: restaurantId,
      customer: { name: 'Анна', phone: '+7 913 123-45-67', email: 'anna@example.com' },
      comment: 'Позвоните, когда заказ будет готов',
      privacyAccepted: true,
      idempotencyKey: crypto.randomUUID(),
    }
    const created = await app.request('/api/store/orders', json(input))
    const createdBody = await created.json()
    expect(created.status).toBe(201)
    expect(createdBody.order).toMatchObject({ status: 'AWAITING_PAYMENT', totalKopecks: 178000 })
    expect(createdBody.accessToken).toHaveLength(43)

    const repeated = await app.request('/api/store/orders', json(input))
    const repeatedBody = await repeated.json()
    expect(repeatedBody.order.id).toBe(createdBody.order.id)
    expect(repeatedBody.accessToken).toBe(createdBody.accessToken)
    expect(await prisma.order.count()).toBe(1)
    const crmCustomer = await prisma.customer.findUnique({ where: { phone: '79131234567' } })
    expect(crmCustomer).toMatchObject({ name: 'Анна', email: 'anna@example.com', status: 'ACTIVE' })
    expect(crmCustomer).not.toBeNull()
    expect(await prisma.order.findUnique({ where: { id: createdBody.order.id }, select: { crmCustomerId: true } })).toEqual({ crmCustomerId: crmCustomer!.id })

    const lead = await app.request('/api/leads', json({
      type: 'CONTACT', name: 'Анна', phone: '+7 (913) 123-45-67', email: null, message: 'Вопрос по заказу', metadata: null, privacyAccepted: true,
    }))
    expect(lead.status).toBe(201)
    const leadId = (await lead.json()).lead.id
    expect(await prisma.lead.findUnique({ where: { id: leadId }, select: { crmCustomerId: true } })).toEqual({ crmCustomerId: crmCustomer!.id })

    const retrieved = await app.request(`/api/store/orders/${createdBody.accessToken}`)
    expect(retrieved.status).toBe(200)
    expect((await retrieved.json()).order.publicNumber).toBe(createdBody.order.publicNumber)
  })

  test('does not accept a disabled pickup point or a client-supplied price', async () => {
    await prisma.restaurant.update({ where: { id: restaurantId }, data: { coffeePickupEnabled: false } })
    const invalid = {
      lines: [{ variantId, quantity: 1, unitPriceKopecks: 1 }],
      pickupRestaurantId: restaurantId,
      customer: { name: 'Анна', phone: '79131234567', email: 'anna@example.com' },
      comment: null,
      privacyAccepted: true,
      idempotencyKey: crypto.randomUUID(),
    }
    expect((await app.request('/api/store/orders', json(invalid))).status).toBe(400)

    delete (invalid.lines[0] as { unitPriceKopecks?: number }).unitPriceKopecks
    const disabled = await app.request('/api/store/orders', json(invalid))
    expect(disabled.status).toBe(409)
    expect((await disabled.json()).error.message).toContain('не принимает')
  })

  test('opens and resumes payment for an unfinished order from its owner account only', async () => {
    const cookie = await loginCustomer('79131234567')
    const created = await app.request('/api/store/orders', {
      ...json({
        lines: [{ variantId, quantity: 1 }],
        pickupRestaurantId: restaurantId,
        customer: { name: 'Анна', phone: '79131234567', email: 'anna@example.com' },
        comment: null,
        privacyAccepted: true,
        idempotencyKey: crypto.randomUUID(),
      }),
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    })
    const createdBody = await created.json()

    const fromAccount = await app.request(`/api/customer/orders/${createdBody.order.id}`, { headers: { Cookie: cookie } })
    expect(fromAccount.status).toBe(200)
    expect((await fromAccount.json()).order.id).toBe(createdBody.order.id)
    expect((await app.request(`/api/customer/orders/${createdBody.order.id}`)).status).toBe(401)

    const otherCookie = await loginCustomer('79130000000')
    expect((await app.request(`/api/customer/orders/${createdBody.order.id}`, {
      headers: { Cookie: otherCookie },
    })).status).toBe(404)

    const payment = await app.request(`/api/customer/orders/${createdBody.order.id}/payment`, {
      method: 'POST',
      headers: { Cookie: cookie },
    })
    expect(payment.status).toBe(200)
    expect((await payment.json()).payment.confirmationUrl).toBe('https://yookassa.test/confirm/payment-1')
  })

  test('creates one YooKassa payment and marks the order paid only after a verified webhook', async () => {
    const created = await app.request('/api/store/orders', json({
      lines: [{ variantId, quantity: 1 }],
      pickupRestaurantId: restaurantId,
      customer: { name: 'Анна', phone: '+7 913 123-45-67', email: 'anna@example.com' },
      comment: null,
      privacyAccepted: true,
      idempotencyKey: crypto.randomUUID(),
    }))
    const createdBody = await created.json()

    const paymentUrl = `/api/store/orders/${createdBody.accessToken}/payment`
    const first = await app.request(paymentUrl, { method: 'POST' })
    const repeated = await app.request(paymentUrl, { method: 'POST' })
    expect(first.status).toBe(200)
    expect(repeated.status).toBe(200)
    expect((await repeated.json()).payment.confirmationUrl).toBe('https://yookassa.test/confirm/payment-1')
    expect(yooKassa.createCalls).toBe(1)
    expect(await prisma.orderPayment.count()).toBe(1)

    const beforeWebhook = await prisma.order.findUniqueOrThrow({ where: { id: createdBody.order.id } })
    expect(beforeWebhook).toMatchObject({ status: 'AWAITING_PAYMENT', paymentStatus: 'PENDING' })

    yooKassa.status = 'succeeded'
    const webhook = await app.request('/api/payments/yookassa/webhook', json({
      type: 'notification',
      event: 'payment.succeeded',
      object: { id: 'payment-1' },
    }))
    expect(webhook.status).toBe(200)
    expect(yooKassa.getCalls).toBe(1)

    const afterWebhook = await prisma.order.findUniqueOrThrow({ where: { id: createdBody.order.id } })
    expect(afterWebhook).toMatchObject({ status: 'PAID', paymentStatus: 'PAID' })
  })

  async function loginCustomer(phone: string) {
    const sent = await app.request('/api/customer/auth/code', json({ phone }))
    const { challengeId } = await sent.json()
    const verified = await app.request('/api/customer/auth/verify', json({ challengeId, code: '1234' }))
    expect(verified.status).toBe(200)
    return verified.headers.get('set-cookie')!.split(';')[0]!
  }
})

function json(body: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function createFakeYooKassa() {
  let payment: YooKassaPayment | null = null
  let status: YooKassaPayment['status'] = 'pending'
  let createCalls = 0
  let getCalls = 0
  const gateway: YooKassaGateway = {
    async createPayment(input) {
      createCalls += 1
      payment = {
        id: 'payment-1',
        status,
        amountKopecks: input.amountKopecks,
        currency: 'RUB',
        confirmationUrl: 'https://yookassa.test/confirm/payment-1',
        metadataOrderId: input.orderId,
        test: true,
        receiptRegistration: 'pending',
      }
      return payment
    },
    async getPayment() {
      getCalls += 1
      if (!payment) throw new Error('Payment was not created')
      return { ...payment, status, receiptRegistration: status === 'succeeded' ? 'succeeded' : 'pending' }
    },
    async createClosingReceipt() {
      return { id: 'receipt-1', status: 'pending' }
    },
  }
  return {
    gateway,
    get status() { return status },
    set status(value: YooKassaPayment['status']) { status = value },
    get createCalls() { return createCalls },
    get getCalls() { return getCalls },
    reset() {
      payment = null
      status = 'pending'
      createCalls = 0
      getCalls = 0
    },
  }
}
