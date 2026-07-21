import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import type { AppEnv } from '../../env'
import { hashPassword } from './infrastructure/passwords'

const databaseUrl = process.env.TEST_DATABASE_URL

const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('auth API integration', () => {
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:5173'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
    SPACES_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
    SPACES_UPLOAD_URL_TTL_SECONDS: 900,
    SPACES_DOWNLOAD_URL_TTL_SECONDS: 300,
    SPACES_PUBLIC_CACHE_CONTROL: 'public, max-age=31536000, immutable',
  }
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
    await prisma.pageView.deleteMany()
    await prisma.product.deleteMany()
    await prisma.restaurant.deleteMany()
    await prisma.menu.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('logs in, reads me, refreshes, and logs out', async () => {
    await createUser('user@example.com', 'password123', 'User')
    const login = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'password123',
      }),
    })
    const loginBody = await login.json()

    expect(login.status).toBe(200)
    expect(loginBody.user.email).toBe('user@example.com')
    expect(loginBody.accessToken).toBeString()
    expect(loginBody.refreshToken).toBeString()
    expect(login.headers.get('set-cookie')).toBeNull()

    const me = await app.request('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${loginBody.accessToken}`,
      },
    })
    expect(me.status).toBe(200)
    const meBody = await me.json()
    expect(meBody).toEqual({ user: loginBody.user })
    expect('sessionId' in meBody.user).toBe(false)

    const refresh = await app.request('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
    })
    const refreshBody = await refresh.json()
    expect(refresh.status).toBe(200)
    expect(refreshBody.accessToken).toBeString()
    expect(refreshBody.refreshToken).toBeString()
    expect(refreshBody.refreshToken).not.toBe(loginBody.refreshToken)
    expect(refresh.headers.get('set-cookie')).toBeNull()

    const staleRefresh = await app.request('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
    })
    expect(staleRefresh.status).toBe(401)

    const logout = await app.request('/api/auth/token/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: refreshBody.refreshToken }),
    })
    expect(logout.status).toBe(204)

    const revokedRefresh = await app.request('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: refreshBody.refreshToken }),
    })
    expect(revokedRefresh.status).toBe(401)
  })

  test('allows only one concurrent refresh rotation for the same token', async () => {
    await createUser('race@example.com')
    const login = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'race@example.com',
        password: 'password123',
      }),
    })
    const loginBody = await login.json()

    const refreshRequests = await Promise.all([
      app.request('/api/auth/token/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
      }),
      app.request('/api/auth/token/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
      }),
    ])

    const statuses = refreshRequests.map((response) => response.status).sort((left, right) => left - right)
    expect(statuses).toEqual([200, 401])

    const activeSessions = await prisma.authSession.count({
      where: {
        user: {
          email: 'race@example.com',
        },
        revokedAt: null,
      },
    })
    expect(activeSessions).toBe(1)
  })

  test('web auth never exposes its HttpOnly refresh token when the client platform header is spoofed', async () => {
    await createUser('web-cookie@example.com')
    const login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({
        email: 'web-cookie@example.com',
        password: 'password123',
      }),
    })
    const loginBody = await login.json()
    const setCookie = login.headers.get('set-cookie')

    expect(login.status).toBe(200)
    expect(loginBody.refreshToken).toBeUndefined()
    expect(setCookie).toContain('chashka_coffee_refresh=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')

    const refresh = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: setCookie!.split(';')[0],
        'X-Client-Platform': 'mobile',
      },
      body: JSON.stringify({}),
    })
    const refreshBody = await refresh.json()

    expect(refresh.status).toBe(200)
    expect(refreshBody.accessToken).toBeString()
    expect(refreshBody.refreshToken).toBeUndefined()
  })

  test('does not let cookie and explicit token transports borrow each other credentials', async () => {
    const refreshToken = 'r'.repeat(32)
    const cookieWithBodyToken = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(cookieWithBodyToken.status).toBe(400)

    const tokenWithCookieOnly = await app.request('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `chashka_coffee_refresh=${refreshToken}`,
      },
      body: JSON.stringify({}),
    })
    expect(tokenWithCookieOnly.status).toBe(400)
  })

  test('production web auth allows exact CORS origin and cross-site refresh cookie', async () => {
    const productionApp = createApp({
      env: {
        ...env,
        CORS_ORIGINS: ['https://web.example.com'],
        COOKIE_SECURE: true,
      },
      prisma,
    })
    await createUser('production-cookie@example.com')
    const login = await productionApp.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://web.example.com',
      },
      body: JSON.stringify({
        email: 'production-cookie@example.com',
        password: 'password123',
      }),
    })
    const loginBody = await login.json()
    const setCookie = login.headers.get('set-cookie')

    expect(login.status).toBe(200)
    expect(login.headers.get('access-control-allow-origin')).toBe('https://web.example.com')
    expect(login.headers.get('access-control-allow-credentials')).toBe('true')
    expect(loginBody.refreshToken).toBeUndefined()
    expect(setCookie).toContain('chashka_coffee_refresh=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=None')
  })

  test('production cookie auth rejects untrusted refresh and logout origins', async () => {
    const productionApp = createApp({
      env: {
        ...env,
        CORS_ORIGINS: ['https://web.example.com'],
        COOKIE_SECURE: true,
      },
      prisma,
    })
    await createUser('csrf-cookie@example.com')
    const login = await productionApp.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://web.example.com',
      },
      body: JSON.stringify({
        email: 'csrf-cookie@example.com',
        password: 'password123',
      }),
    })
    const cookie = login.headers.get('set-cookie')!.split(';')[0]

    const noOriginRefresh = await productionApp.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({}),
    })
    const noOriginBody = await noOriginRefresh.json()
    expect(noOriginRefresh.status).toBe(403)
    expect(noOriginBody.error.code).toBe('FORBIDDEN')

    const untrustedLogout = await productionApp.request('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://attacker.example',
      },
      body: JSON.stringify({}),
    })
    const untrustedLogoutBody = await untrustedLogout.json()
    expect(untrustedLogout.status).toBe(403)
    expect(untrustedLogoutBody.error.code).toBe('FORBIDDEN')

    const allowedRefresh = await productionApp.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://web.example.com',
      },
      body: JSON.stringify({}),
    })
    expect(allowedRefresh.status).toBe(200)
  })

  test('guards me and returns stable validation errors', async () => {
    const unauthorizedMe = await app.request('/api/auth/me')
    expect(unauthorizedMe.status).toBe(401)

    const invalidLogin = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'short',
      }),
    })
    const body = await invalidLogin.json()

    expect(invalidLogin.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('Invalid request payload')
    expect(Array.isArray(body.error.details)).toBe(true)
  })

  test('me rejects revoked, expired, and missing sessions', async () => {
    const revoked = await loginForMeGuard('me-revoked@example.com')
    await prisma.authSession.updateMany({
      where: {
        userId: revoked.userId,
      },
      data: {
        revokedAt: new Date(),
      },
    })
    const revokedMe = await app.request('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${revoked.accessToken}`,
      },
    })
    expect(revokedMe.status).toBe(401)

    const expired = await loginForMeGuard('me-expired@example.com')
    await prisma.authSession.updateMany({
      where: {
        userId: expired.userId,
      },
      data: {
        expiresAt: new Date(Date.now() - 1000),
      },
    })
    const expiredMe = await app.request('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${expired.accessToken}`,
      },
    })
    expect(expiredMe.status).toBe(401)

    const missing = await loginForMeGuard('me-missing@example.com')
    await prisma.authSession.deleteMany({
      where: {
        userId: missing.userId,
      },
    })
    const missingMe = await app.request('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${missing.accessToken}`,
      },
    })
    expect(missingMe.status).toBe(401)
  })

  test('keeps public registration unavailable and rejects invalid login', async () => {
    const payload = {
      email: 'dupe@example.com',
      password: 'password123',
    }

    const cookieRegistration = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const tokenRegistration = await app.request('/api/auth/token/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(cookieRegistration.status).toBe(404)
    expect(tokenRegistration.status).toBe(404)

    await createUser(payload.email, payload.password)
    const invalidLogin = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: payload.email,
        password: 'wrong-password',
      }),
    })
    expect(invalidLogin.status).toBe(401)
  })

  test('creates independent sessions for concurrent valid logins', async () => {
    const payload = { email: 'login-race@example.com', password: 'password123' }
    await createUser(payload.email, payload.password)

    const [first, second] = await Promise.all([
      app.request('/api/auth/token/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      app.request('/api/auth/token/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    ])

    expect([first.status, second.status]).toEqual([200, 200])

    const sessions = await prisma.authSession.count({ where: { user: { email: payload.email }, revokedAt: null } })
    expect(sessions).toBe(2)
  })

  test('lets an administrator manage staff while protecting the last administrator', async () => {
    const administrator = await createUser('owner@example.com', 'password123', 'Владелец', 'ADMIN')
    const adminLogin = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'password123' }),
    })
    const { accessToken } = await adminLogin.json()
    const authorization = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

    const created = await app.request('/api/admin/users', {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({ email: 'editor@example.com', password: 'temporary-password', displayName: 'Редактор', role: 'EDITOR' }),
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const updated = await app.request(`/api/admin/users/${createdBody.user.id}`, {
      method: 'PUT',
      headers: authorization,
      body: JSON.stringify({ email: 'content@example.com', password: 'updated-password', displayName: 'Контент-менеджер', role: 'EDITOR' }),
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).user).toMatchObject({ email: 'content@example.com', displayName: 'Контент-менеджер' })

    const oldPassword = await app.request('/api/auth/token/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'content@example.com', password: 'temporary-password' }),
    })
    const newPassword = await app.request('/api/auth/token/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'content@example.com', password: 'updated-password' }),
    })
    expect(oldPassword.status).toBe(401)
    expect(newPassword.status).toBe(200)

    const selfDelete = await app.request(`/api/admin/users/${administrator.id}`, { method: 'DELETE', headers: authorization })
    expect(selfDelete.status).toBe(409)

    const demoteLastAdmin = await app.request(`/api/admin/users/${administrator.id}`, {
      method: 'PUT',
      headers: authorization,
      body: JSON.stringify({ email: administrator.email, displayName: administrator.displayName, role: 'EDITOR' }),
    })
    expect(demoteLastAdmin.status).toBe(409)

    const deleted = await app.request(`/api/admin/users/${createdBody.user.id}`, { method: 'DELETE', headers: authorization })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ deleted: true })
    expect(await prisma.user.findUnique({ where: { id: createdBody.user.id } })).toBeNull()
  })

  test('records anonymous page views and exposes their summary only to administrators', async () => {
    const visitorId = 'b3d1ac58-2630-4f66-97b8-70214886811c'
    const record = await app.request('/api/analytics/page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/menu', visitorId, referrer: null, device: 'MOBILE' }),
    })
    expect(record.status).toBe(201)

    const anonymousSummary = await app.request('/api/admin/analytics?days=7')
    expect(anonymousSummary.status).toBe(401)

    await createUser('analytics@example.com', 'password123', 'Аналитик', 'ADMIN')
    const login = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analytics@example.com', password: 'password123' }),
    })
    const { accessToken } = await login.json()
    const summary = await app.request('/api/admin/analytics?days=7', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(summary.status).toBe(200)
    expect(await summary.json()).toMatchObject({
      periodDays: 7,
      overview: { views: 1, visitors: 1, todayViews: 1 },
      topPages: [{ path: '/menu', views: 1, visitors: 1 }],
    })
  })

  test('creates duplicate-named products safely and lets administrators delete catalog records', async () => {
    await createUser('catalog@example.com', 'password123', 'Каталог', 'ADMIN')
    const login = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'catalog@example.com', password: 'password123' }),
    })
    const { accessToken } = await login.json()
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    const productPayload = {
      type: 'COFFEE', status: 'DRAFT', slug: 'ethiopia-guji', name: 'Эфиопия Гуджи',
      subtitle: null, description: null, ingredients: null, origin: null, roastLevel: null,
      tastingNotes: [], imageUrl: null, galleryUrls: [], details: [], isFeatured: false, position: 10,
      variants: [{ label: '250 г', weightGrams: 250, priceKopecks: 79000, position: 10, isAvailable: true }],
    }

    const firstProduct = await app.request('/api/admin/products', { method: 'POST', headers, body: JSON.stringify(productPayload) })
    const secondProduct = await app.request('/api/admin/products', { method: 'POST', headers, body: JSON.stringify(productPayload) })
    const firstBody = await firstProduct.json()
    const secondBody = await secondProduct.json()
    expect(firstProduct.status).toBe(201)
    expect(secondProduct.status).toBe(201)
    expect(firstBody.product.slug).toBe('ethiopia-guji')
    expect(secondBody.product.slug).toBe('ethiopia-guji-2')

    const deletedProduct = await app.request(`/api/admin/products/${firstBody.product.id}`, { method: 'DELETE', headers })
    expect(deletedProduct.status).toBe(200)
    expect(await deletedProduct.json()).toEqual({ success: true })
    expect(await prisma.product.findUnique({ where: { id: firstBody.product.id } })).toBeNull()

    const restaurantPayload = {
      slug: 'krasny-prospekt', name: 'Чашка кофе на Красном проспекте', format: 'CITY', area: 'CITY',
      isAtApartHotel: false, city: 'Новосибирск', address: 'Красный проспект, 25', phone: '+7 383 000-00-00',
      description: null, coverImageUrl: null, latitude: null, longitude: null, yandexMapsUrl: null, twoGisUrl: null,
      openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, opensAt: '08:00', closesAt: '22:00', isClosed: false })),
    }
    const restaurant = await app.request('/api/admin/restaurants', { method: 'POST', headers, body: JSON.stringify(restaurantPayload) })
    const restaurantBody = await restaurant.json()
    expect(restaurant.status).toBe(201)

    const deletedRestaurant = await app.request(`/api/admin/restaurants/${restaurantBody.restaurant.id}`, { method: 'DELETE', headers })
    expect(deletedRestaurant.status).toBe(200)
    expect(await deletedRestaurant.json()).toEqual({ success: true })
    expect(await prisma.restaurant.findUnique({ where: { id: restaurantBody.restaurant.id } })).toBeNull()

    const menu = await app.request('/api/admin/menus', {
      method: 'POST', headers, body: JSON.stringify({ slug: 'main-menu', name: 'Основное меню', description: null }),
    })
    const menuBody = await menu.json()
    expect(menu.status).toBe(201)

    const category = await app.request(`/api/admin/menus/${menuBody.menu.id}/categories`, {
      method: 'POST', headers, body: JSON.stringify({ slug: 'breakfasts', name: 'Завтраки', position: 10 }),
    })
    const categoryBody = await category.json()
    expect(category.status).toBe(201)

    const itemPayload = {
      slug: 'avocado-toast', name: 'Тост с авокадо', description: null, ingredients: null,
      weightGrams: 220, priceKopecks: 59000, calories: null, proteins: null, fats: null, carbohydrates: null,
      isVegetarian: true, isSpicy: false, isLactoseFree: false, isGlutenFree: false, isLight: false,
      marketingBadge: 'NEW', imageUrl: null, position: 10,
    }
    const item = await app.request(`/api/admin/categories/${categoryBody.id}/items`, {
      method: 'POST', headers, body: JSON.stringify(itemPayload),
    })
    const itemBody = await item.json()
    expect(item.status).toBe(201)

    const deletedItem = await app.request(`/api/admin/items/${itemBody.id}`, { method: 'DELETE', headers })
    expect(deletedItem.status).toBe(200)
    expect(await deletedItem.json()).toEqual({ success: true })

    const deletedCategory = await app.request(`/api/admin/categories/${categoryBody.id}`, { method: 'DELETE', headers })
    expect(deletedCategory.status).toBe(200)
    expect(await deletedCategory.json()).toEqual({ success: true })

    const deletedMenu = await app.request(`/api/admin/menus/${menuBody.menu.id}`, { method: 'DELETE', headers })
    expect(deletedMenu.status).toBe(200)
    expect(await deletedMenu.json()).toEqual({ success: true })
  })

  async function loginForMeGuard(email: string) {
    await createUser(email)
    const login = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: 'password123',
      }),
    })
    const loginBody = await login.json()
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        email,
      },
      select: {
        id: true,
      },
    })

    expect(login.status).toBe(200)
    expect(loginBody.accessToken).toBeString()

    return {
      accessToken: loginBody.accessToken as string,
      userId: user.id,
    }
  }

  async function createUser(email: string, password = 'password123', displayName: string | null = null, role: 'ADMIN' | 'EDITOR' = 'EDITOR') {
    return prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        displayName,
        role,
      },
    })
  }
})
