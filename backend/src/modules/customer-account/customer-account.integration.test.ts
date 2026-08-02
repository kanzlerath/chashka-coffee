import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import type { AppEnv } from '../../env'
import type { LoyaltyCustomer, PremiumBonusGateway } from './application/ports'
import { CustomerAccountFailure } from './domain/errors'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('customer account API integration', () => {
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:4321'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
    SPACES_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
    SPACES_UPLOAD_URL_TTL_SECONDS: 900,
    SPACES_DOWNLOAD_URL_TTL_SECONDS: 300,
    SPACES_PUBLIC_CACHE_CONTROL: 'public, max-age=31536000, immutable',
  }
  const prisma = createPrisma(databaseUrl!)
  let profile: LoyaltyCustomer
  let gateway: PremiumBonusGateway

  beforeEach(async () => {
    await prisma.customerLoginChallenge.deleteMany()
    await prisma.customerSession.deleteMany()
    await prisma.customerAccount.deleteMany()
    profile = registeredCustomer()
    gateway = {
      getCustomer: mock(() => Promise.resolve(profile)),
      sendLoginCode: mock(() => Promise.resolve()),
      verifyLoginCode: mock((_phone, code) => {
        if (code !== '1234') {
          throw new CustomerAccountFailure('code_invalid', 'Неверный код из SMS')
        }
        return Promise.resolve()
      }),
      generateOrderCode: mock(() => Promise.resolve('481516')),
    }
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('logs in with SMS, reads a fresh profile, generates QR data, and logs out', async () => {
    const app = createApp({ env, prisma, premiumBonusGateway: gateway })
    const sent = await app.request('/api/customer/auth/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+7 (913) 123-45-67' }),
    })
    const sentBody = await sent.json()

    expect(sent.status).toBe(202)
    expect(sentBody.challengeId).toBeString()
    expect(sent.headers.get('set-cookie')).toBeNull()
    expect(gateway.sendLoginCode).toHaveBeenCalledWith('79131234567')

    const verified = await app.request('/api/customer/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: sentBody.challengeId, code: '1234' }),
    })
    const verifiedBody = await verified.json()
    const setCookie = verified.headers.get('set-cookie')

    expect(verified.status).toBe(200)
    expect(verifiedBody.customer).toMatchObject({
      phone: '79131234567',
      name: 'Анна',
      balance: 725.5,
    })
    expect(setCookie).toContain('chashka_customer_session=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Max-Age=604800')
    expect(setCookie).toContain('SameSite=Lax')
    expect(JSON.stringify(verifiedBody)).not.toContain('sessionToken')

    const cookie = setCookie!.split(';')[0]
    profile = { ...profile, balance: 800 }
    const me = await app.request('/api/customer/me', { headers: { Cookie: cookie } })
    expect(me.status).toBe(200)
    expect((await me.json()).customer.balance).toBe(800)

    const qr = await app.request('/api/customer/qr', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(qr.status).toBe(200)
    expect(await qr.json()).toMatchObject({ value: '481516' })

    const logout = await app.request('/api/customer/logout', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(logout.status).toBe(204)

    const afterLogout = await app.request('/api/customer/me', { headers: { Cookie: cookie } })
    expect(afterLogout.status).toBe(401)
  })

  test('does not issue SMS or expose data for unknown and blocked customers', async () => {
    profile = { ...registeredCustomer(), registered: false, clientId: null }
    let app = createApp({ env, prisma, premiumBonusGateway: gateway })
    const unknown = await sendCode(app)
    expect(unknown.status).toBe(404)
    expect((await unknown.json()).error.code).toBe('CUSTOMER_NOT_REGISTERED')
    expect(gateway.sendLoginCode).not.toHaveBeenCalled()

    profile = { ...registeredCustomer(), blocked: true }
    app = createApp({ env, prisma, premiumBonusGateway: gateway })
    const blocked = await sendCode(app)
    expect(blocked.status).toBe(403)
    expect((await blocked.json()).error.code).toBe('CUSTOMER_BLOCKED')
    expect(gateway.sendLoginCode).not.toHaveBeenCalled()
  })

  test('consumes a challenge once and throttles repeated code requests', async () => {
    const app = createApp({ env, prisma, premiumBonusGateway: gateway })
    const sent = await sendCode(app)
    const { challengeId } = await sent.json()

    const repeated = await sendCode(app)
    expect(repeated.status).toBe(429)
    expect((await repeated.json()).error.code).toBe('TOO_MANY_REQUESTS')

    const firstVerify = await verifyCode(app, challengeId, '1234')
    expect(firstVerify.status).toBe(200)
    const replay = await verifyCode(app, challengeId, '1234')
    expect(replay.status).toBe(400)
    expect((await replay.json()).error.code).toBe('CODE_EXPIRED')
  })

  function sendCode(app: ReturnType<typeof createApp>) {
    return app.request('/api/customer/auth/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '79131234567' }),
    })
  }

  function verifyCode(app: ReturnType<typeof createApp>, challengeId: string, code: string) {
    return app.request('/api/customer/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, code }),
    })
  }
})

function registeredCustomer(): LoyaltyCustomer {
  return {
    registered: true,
    blocked: false,
    clientId: 'pb-client-1',
    phone: '79131234567',
    name: 'Анна',
    surname: 'Иванова',
    middleName: null,
    email: null,
    cardNumber: '123456',
    balance: 725.5,
  }
}

