import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import type { AppEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('online coffee order API integration', () => {
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:4321'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
    MEDIA_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
    WEBSITE_BUILD_DEBOUNCE_SECONDS: 45,
    WEBSITE_BUILD_POLL_SECONDS: 10,
    WEBSITE_BUILD_RETRY_SECONDS: 300,
    SPACES_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
    SPACES_UPLOAD_URL_TTL_SECONDS: 900,
    SPACES_DOWNLOAD_URL_TTL_SECONDS: 300,
    SPACES_PUBLIC_CACHE_CONTROL: 'public, max-age=31536000, immutable',
  }
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })
  let variantId = ''
  let restaurantId = ''

  beforeEach(async () => {
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
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
    expect((await locations.json()).locations).toHaveLength(1)

    const quote = await app.request('/api/store/quote', json({ lines: [{ variantId, quantity: 2 }] }))
    expect(quote.status).toBe(200)
    expect(await quote.json()).toMatchObject({ itemCount: 2, totalKopecks: 178000, unavailableLines: [] })

    const input = {
      lines: [{ variantId, quantity: 2 }],
      pickupRestaurantId: restaurantId,
      customer: { name: 'Анна', phone: '+7 913 123-45-67', email: null },
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
    expect(crmCustomer).toMatchObject({ name: 'Анна', email: null, status: 'ACTIVE' })
    expect(crmCustomer).not.toBeNull()
    expect(await prisma.order.findUnique({ where: { id: createdBody.order.id }, select: { crmCustomerId: true } })).toEqual({ crmCustomerId: crmCustomer!.id })

    const lead = await app.request('/api/leads', json({
      type: 'CONTACT', name: 'Анна', phone: '+7 (913) 123-45-67', email: null, message: 'Вопрос по заказу', metadata: null,
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
      customer: { name: 'Анна', phone: '79131234567', email: null },
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
})

function json(body: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
