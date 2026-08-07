import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { crmCustomerResponseSchema } from '@chashka-coffee/contracts'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import type { AppEnv } from '../../env'
import { hashPassword } from '../auth'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('CRM API integration', () => {
  const env: AppEnv = {
    PORT: 3000, DATABASE_URL: databaseUrl!, JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:5173'], ACCESS_TOKEN_TTL_SECONDS: 60, REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false, MEDIA_UPLOAD_MAX_BYTES: 10 * 1024 * 1024, SPACES_UPLOAD_MAX_BYTES: 10 * 1024 * 1024, SPACES_UPLOAD_URL_TTL_SECONDS: 900,
    SPACES_DOWNLOAD_URL_TTL_SECONDS: 300, SPACES_PUBLIC_CACHE_CONTROL: 'public, max-age=31536000, immutable',
  }
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
    await prisma.adminAuditEvent.deleteMany()
    await prisma.notificationDelivery.deleteMany()
    await prisma.notificationCampaign.deleteMany()
    await prisma.customerPushSubscription.deleteMany()
    await prisma.customerConsent.deleteMany()
    await prisma.customerNote.deleteMany()
    await prisma.customerTagAssignment.deleteMany()
    await prisma.customerTag.deleteMany()
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    await prisma.lead.deleteMany()
    await prisma.customerAccount.updateMany({ data: { crmCustomerId: null } })
    await prisma.customer.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => prisma.$disconnect())

  test('lists, segments and manages an online customer with business analytics', async () => {
    const adminHeaders = await login('crm-admin@example.com', ['SUPER_ADMIN'])
    const customer = await prisma.customer.create({ data: { name: 'Анна', phone: '79131234567', email: 'anna@example.com' } })
    await prisma.customerConsent.create({ data: { customerId: customer.id, channel: 'PUSH', status: 'GRANTED', source: 'website_checkout', grantedAt: new Date() } })
    await prisma.customerPushSubscription.create({ data: { customerId: customer.id, provider: 'WEB_PUSH', platform: 'WEB', endpoint: 'https://push.example/subscription-1', p256dh: 'public-key', authSecret: 'auth-secret' } })
    await prisma.order.create({ data: orderData(customer.id, 'CRM-100001', 60_000, new Date('2026-08-01T10:00:00.000Z')) })
    await prisma.order.create({ data: orderData(customer.id, 'CRM-100002', 90_000, new Date('2026-08-03T10:00:00.000Z')) })
    await prisma.lead.create({ data: { type: 'CONTACT', name: 'Анна', phone: customer.phone, message: 'Вопрос по помолу', crmCustomerId: customer.id } })

    const list = await app.request('/api/admin/customers?segment=REPEAT&sort=TOTAL_SPENT_DESC', { headers: adminHeaders })
    expect(list.status).toBe(200)
    expect((await list.json()).customers[0]).toMatchObject({
      id: customer.id,
      metrics: { orderCount: 2, paidOrderCount: 2, totalSpentKopecks: 150_000, averageCheckKopecks: 75_000 },
    })

    const tag = await app.request('/api/admin/customer-tags', json(adminHeaders, { name: 'VIP вручную', color: '#A44A3F' }))
    expect(tag.status).toBe(201)
    const tagId = (await tag.json()).tag.id
    const assigned = await app.request(`/api/admin/customers/${customer.id}/tags`, json(adminHeaders, { tagIds: [tagId] }, 'PUT'))
    expect((await assigned.json()).customer.tags[0].name).toBe('VIP вручную')

    const note = await app.request(`/api/admin/customers/${customer.id}/notes`, json(adminHeaders, { body: 'Предпочитает светлую обжарку' }))
    expect(note.status).toBe(201)
    expect((await note.json()).note.author.email).toBe('crm-admin@example.com')

    const detail = await app.request(`/api/admin/customers/${customer.id}`, { headers: adminHeaders })
    const detailBody = await detail.json()
    expect(() => crmCustomerResponseSchema.parse(detailBody)).not.toThrow()
    expect(detailBody.customer.orders).toHaveLength(2)
    expect(detailBody.customer.leads).toHaveLength(1)
    expect(detailBody.customer.notes).toHaveLength(1)
    expect(detailBody.customer.activePushSubscriptions).toBe(1)
    expect(detailBody.customer.consents).toEqual([expect.objectContaining({ channel: 'PUSH', status: 'GRANTED' })])

    const analytics = await app.request('/api/admin/crm-analytics?days=30', { headers: adminHeaders })
    expect(analytics.status).toBe(200)
    expect((await analytics.json()).overview).toMatchObject({ revenueKopecks: 150_000, paidOrders: 2, averageCheckKopecks: 75_000 })
  })

  test('keeps CRM inaccessible to operational roles', async () => {
    const operatorHeaders = await login('orders@example.com', ['ORDER_OPERATOR'])
    expect((await app.request('/api/admin/customers', { headers: operatorHeaders })).status).toBe(403)
    expect((await app.request('/api/admin/crm-analytics', { headers: operatorHeaders })).status).toBe(403)
  })

  async function login(email: string, roles: Array<'SUPER_ADMIN' | 'ORDER_OPERATOR'>) {
    await prisma.user.create({ data: { email, passwordHash: await hashPassword('password123'), role: roles.includes('SUPER_ADMIN') ? 'ADMIN' : 'EDITOR', roles } })
    const response = await app.request('/api/auth/token/login', json({}, { email, password: 'password123' }))
    const body = await response.json()
    return { Authorization: `Bearer ${body.accessToken}`, 'Content-Type': 'application/json' }
  }
})

function orderData(crmCustomerId: string, publicNumber: string, totalKopecks: number, createdAt: Date) {
  return {
    publicNumber, accessTokenHash: crypto.randomUUID().replaceAll('-', ''), idempotencyKey: crypto.randomUUID(), crmCustomerId,
    status: 'COMPLETED' as const, paymentStatus: 'PAID' as const, customerName: 'Анна', customerPhone: '79131234567', customerEmail: 'anna@example.com',
    pickupSlug: 'center', pickupName: 'Чашка кофе — Центр', pickupCity: 'Новосибирск', pickupAddress: 'Красный проспект, 25', pickupPhone: '+73830000000',
    pickupOpeningHoursLabel: 'Ежедневно: 08:00–22:00', itemCount: 1, totalKopecks, createdAt,
    items: { create: { productName: 'Эфиопия Гуджи', variantLabel: '250 г', unitPriceKopecks: totalKopecks, quantity: 1, totalKopecks } },
  }
}

function json(headers: Record<string, string>, body: unknown, method = 'POST') {
  return { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }
}
