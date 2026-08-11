import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UserRole } from '@chashka-coffee/contracts'
import sharp from 'sharp'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import type { AppEnv } from '../../env'
import { hashPassword } from './infrastructure/passwords'

const databaseUrl = process.env.TEST_DATABASE_URL
const mediaUploadsDirectory = join(tmpdir(), `chashka-coffee-media-${process.pid}`)

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
    MEDIA_UPLOADS_DIR: mediaUploadsDirectory,
    MEDIA_UPLOAD_MAX_BYTES: 1024,
    MEDIA_VIDEO_UPLOAD_MAX_BYTES: 2048,
    MEDIA_DOCUMENT_UPLOAD_MAX_BYTES: 2048,
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

  beforeEach(async () => {
    await rm(mediaUploadsDirectory, { recursive: true, force: true })
    await mkdir(mediaUploadsDirectory, { recursive: true })
    await prisma.adminAuditEvent.deleteMany()
    await prisma.pageView.deleteMany()
    await prisma.managedPage.deleteMany()
    await prisma.contentEntry.deleteMany()
    await prisma.jobOpening.deleteMany()
    await prisma.lead.deleteMany()
    await prisma.mediaAsset.deleteMany()
    await prisma.websiteBuildState.deleteMany()
    await prisma.product.deleteMany()
    await prisma.restaurant.deleteMany()
    await prisma.menu.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await rm(mediaUploadsDirectory, { recursive: true, force: true })
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

  test('stores validated image and video uploads in local media storage with site-relative URLs', async () => {
    await createUser('media@example.com', 'password123', 'Редактор медиа', ['CONTENT_MANAGER'])
    const login = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'media@example.com', password: 'password123' }),
    })
    const { accessToken } = await login.json()
    const form = new FormData()
    const imageBytes = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#80583e' } }).png().toBuffer()
    form.set('file', new File([imageBytes], 'latte.jpg', { type: 'image/png' }))

    const response = await app.request('/api/admin/media/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.asset).toMatchObject({
      publicUrl: expect.stringMatching(/^\/uploads\/media\//),
      thumbnailUrl: expect.stringMatching(/^\/uploads\/media\/.*\.thumbnail\.webp$/),
      filename: 'latte.jpg',
      contentType: 'image/png',
      status: 'READY',
    })
    expect(body.asset.objectKey).toEndWith('.png')
    expect(body.alreadyExists).toBe(false)
    expect(await readFile(join(mediaUploadsDirectory, body.asset.objectKey))).toEqual(Buffer.from(imageBytes))
    expect(await Bun.file(join(mediaUploadsDirectory, body.asset.thumbnailUrl.replace('/uploads/', ''))).exists()).toBe(true)

    const duplicateForm = new FormData()
    duplicateForm.set('file', new File([imageBytes], 'latte.jpg', { type: 'image/png' }))
    const duplicate = await app.request('/api/admin/media/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: duplicateForm,
    })
    const duplicateBody = await duplicate.json()

    expect(duplicate.status).toBe(200)
    expect(duplicateBody).toMatchObject({ asset: { id: body.asset.id }, alreadyExists: true })
    expect(await prisma.mediaAsset.count({ where: { filename: 'latte.jpg' } })).toBe(1)

    const storedImage = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: body.asset.id } })
    await prisma.contentEntry.create({ data: { type: 'ARTICLE', slug: 'media-reference', title: 'Файл из медиатеки', imageUrl: storedImage.publicUrl } })
    const usedFile = await app.request(`/api/admin/media/${storedImage.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(usedFile.status).toBe(409)
    await prisma.contentEntry.delete({ where: { slug: 'media-reference' } })

    const removedFile = await app.request(`/api/admin/media/${storedImage.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(removedFile.status).toBe(200)
    expect(await Bun.file(join(mediaUploadsDirectory, storedImage.objectKey)).exists()).toBe(false)
    expect(await Bun.file(join(mediaUploadsDirectory, body.asset.thumbnailUrl.replace('/uploads/', ''))).exists()).toBe(false)

    const oversizedForm = new FormData()
    oversizedForm.set('file', new File([new Uint8Array(2_048)], 'too-large.png', { type: 'image/png' }))
    const oversized = await app.request('/api/admin/media/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: oversizedForm,
    })
    expect(oversized.status).toBe(400)

    const videoForm = new FormData()
    const videoBytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d])
    videoForm.set('file', new File([videoBytes], 'morning.mov', { type: 'video/mp4' }))

    const videoResponse = await app.request('/api/admin/media/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: videoForm,
    })
    const videoBody = await videoResponse.json()

    expect(videoResponse.status).toBe(201)
    expect(videoBody.asset).toMatchObject({
      publicUrl: expect.stringMatching(/^\/uploads\/media\//),
      thumbnailUrl: null,
      filename: 'morning.mov',
      contentType: 'video/mp4',
      status: 'READY',
    })
    expect(videoBody.asset.objectKey).toEndWith('.mp4')
    expect(await readFile(join(mediaUploadsDirectory, videoBody.asset.objectKey))).toEqual(Buffer.from(videoBytes))

    const pdfForm = new FormData()
    const pdfBytes = new TextEncoder().encode('%PDF-1.7\n')
    pdfForm.set('file', new File([pdfBytes], 'restaurant-menu.doc', { type: 'application/pdf' }))

    const pdfResponse = await app.request('/api/admin/media/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: pdfForm,
    })
    const pdfBody = await pdfResponse.json()

    expect(pdfResponse.status).toBe(201)
    expect(pdfBody.asset).toMatchObject({
      publicUrl: expect.stringMatching(/^\/uploads\/media\//),
      thumbnailUrl: null,
      filename: 'restaurant-menu.doc',
      contentType: 'application/pdf',
      status: 'READY',
    })
    expect(pdfBody.asset.objectKey).toEndWith('.pdf')
    expect(await readFile(join(mediaUploadsDirectory, pdfBody.asset.objectKey))).toEqual(Buffer.from(pdfBytes))
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

  test('lets a super administrator assign composable roles while protecting the last super administrator', async () => {
    const administrator = await createUser('owner@example.com', 'password123', 'Владелец', ['SUPER_ADMIN'])
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
      body: JSON.stringify({ email: 'editor@example.com', password: 'temporary-password', displayName: 'Редактор', roles: ['CONTENT_MANAGER', 'CATALOG_MANAGER'] }),
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const updated = await app.request(`/api/admin/users/${createdBody.user.id}`, {
      method: 'PUT',
      headers: authorization,
      body: JSON.stringify({ email: 'content@example.com', password: 'updated-password', displayName: 'Контент-менеджер', roles: ['CONTENT_MANAGER'] }),
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
      body: JSON.stringify({ email: administrator.email, displayName: administrator.displayName, roles: ['CONTENT_MANAGER'] }),
    })
    expect(demoteLastAdmin.status).toBe(409)

    const deleted = await app.request(`/api/admin/users/${createdBody.user.id}`, { method: 'DELETE', headers: authorization })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ deleted: true })
    expect(await prisma.user.findUnique({ where: { id: createdBody.user.id } })).toBeNull()
  })

  test('keeps operational roles inside their assigned work areas', async () => {
    await prisma.lead.createMany({ data: [
      { type: 'CONTACT', name: 'Гость', phone: '79130000001', email: null, message: 'Вопрос' },
      { type: 'JOB', name: 'Кандидат', phone: '79130000002', email: null, message: 'Отклик' },
    ] })
    await createUser('leads@example.com', 'password123', 'Оператор заявок', ['LEAD_OPERATOR'])
    await createUser('recruiter@example.com', 'password123', 'Рекрутер', ['RECRUITER'])
    await createUser('orders@example.com', 'password123', 'Оператор заказов', ['ORDER_OPERATOR'])

    const loginAs = async (email: string) => {
      const response = await app.request('/api/auth/token/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      })
      const body = await response.json()
      return { Authorization: `Bearer ${body.accessToken}` }
    }

    const leadHeaders = await loginAs('leads@example.com')
    const recruiterHeaders = await loginAs('recruiter@example.com')
    const orderHeaders = await loginAs('orders@example.com')

    const operatorLeads = await (await app.request('/api/admin/leads', { headers: leadHeaders })).json()
    const recruiterLeads = await (await app.request('/api/admin/leads', { headers: recruiterHeaders })).json()
    expect(operatorLeads.leads.map((lead: { type: string }) => lead.type)).toEqual(['CONTACT'])
    expect(recruiterLeads.leads.map((lead: { type: string }) => lead.type)).toEqual(['JOB'])
    expect((await app.request('/api/admin/jobs', { headers: recruiterHeaders })).status).toBe(200)
    expect((await app.request('/api/admin/jobs', { headers: leadHeaders })).status).toBe(403)
    expect((await app.request('/api/admin/orders', { headers: orderHeaders })).status).toBe(200)
    expect((await app.request('/api/admin/users', { headers: orderHeaders })).status).toBe(403)
    expect((await app.request('/api/admin/analytics?days=7', { headers: recruiterHeaders })).status).toBe(403)
  })

  test('lets a recruiter link a vacancy to a restaurant and exposes the address in public data', async () => {
    const restaurant = await prisma.restaurant.create({
      data: { slug: 'krasny-prospekt', name: 'Чашка кофе', format: 'CITY', area: 'CITY', city: 'Новосибирск', address: 'Красный проспект, 25', phone: '+7 (383) 000-00-00' },
    })
    await createUser('recruiter@example.com', 'password123', 'Рекрутер', ['RECRUITER'])
    const login = await app.request('/api/auth/token/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'recruiter@example.com', password: 'password123' }),
    })
    const { accessToken } = await login.json()
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

    const restaurantOptions = await app.request('/api/admin/jobs/restaurants', { headers })
    expect(restaurantOptions.status).toBe(200)
    expect((await restaurantOptions.json()).restaurants).toEqual([{ id: restaurant.id, name: 'Чашка кофе', address: 'Красный проспект, 25' }])

    const created = await app.request('/api/admin/jobs', {
      method: 'POST', headers,
      body: JSON.stringify({ slug: 'barista-krasny', title: 'Бариста', department: 'Ресторан', location: null, employmentType: 'Сменный график', description: 'Готовить напитки и помогать гостям.', restaurantId: restaurant.id, status: 'PUBLISHED', publishAt: null, position: 10 }),
    })
    expect(created.status).toBe(201)
    expect((await created.json()).opening.restaurant).toEqual({ id: restaurant.id, name: 'Чашка кофе', address: 'Красный проспект, 25' })

    const publicJobs = await app.request('/api/jobs')
    expect(publicJobs.status).toBe(200)
    expect((await publicJobs.json()).openings[0]).toMatchObject({ title: 'Бариста', restaurant: { id: restaurant.id, address: 'Красный проспект, 25' } })
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

    await createUser('analytics@example.com', 'password123', 'Аналитик', ['SUPER_ADMIN'])
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

  test('copies products and menu sets with independent children and lets administrators delete catalog records', async () => {
    await createUser('catalog@example.com', 'password123', 'Каталог', ['CATALOG_MANAGER'])
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
      blocks: [{ id: '018f20e8-38e4-7a65-9aa5-77e1d8613a11', type: 'TEXT', isVisible: true, title: 'Как заваривать', text: '<p>Для фильтра.</p>' }],
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

    const copiedProduct = await app.request(`/api/admin/products/${firstBody.product.id}/copy`, { method: 'POST', headers })
    const copiedProductBody = await copiedProduct.json()
    expect(copiedProduct.status).toBe(201)
    expect(copiedProductBody.product).toMatchObject({
      name: 'Эфиопия Гуджи — копия',
      slug: 'ethiopia-guji-copy',
      status: 'DRAFT',
    })
    expect(copiedProductBody.product.id).not.toBe(firstBody.product.id)
    expect(copiedProductBody.product.variants).toHaveLength(1)
    expect(copiedProductBody.product.variants[0]).toMatchObject({ label: '250 г', weightGrams: 250, priceKopecks: 79000 })
    expect(copiedProductBody.product.variants[0].id).not.toBe(firstBody.product.variants[0].id)
    expect(copiedProductBody.product.blocks).toMatchObject([{ type: 'TEXT', title: 'Как заваривать' }])

    const copiedProductAgain = await app.request(`/api/admin/products/${firstBody.product.id}/copy`, { method: 'POST', headers })
    expect(await copiedProductAgain.json()).toMatchObject({ product: { name: 'Эфиопия Гуджи — копия 2', slug: 'ethiopia-guji-copy-2' } })

    const cake = await app.request('/api/admin/products', {
      method: 'POST', headers, body: JSON.stringify({ ...productPayload, type: 'CAKE', slug: 'honey-cake', name: 'Медовик', category: 'Торты' }),
    })
    const cakeBody = await cake.json()
    const copiedCake = await app.request(`/api/admin/products/${cakeBody.product.id}/copy`, { method: 'POST', headers })
    expect(await copiedCake.json()).toMatchObject({ product: { type: 'CAKE', name: 'Медовик — копия', slug: 'honey-cake-copy', status: 'DRAFT' } })

    const deletedProduct = await app.request(`/api/admin/products/${firstBody.product.id}`, { method: 'DELETE', headers })
    expect(deletedProduct.status).toBe(200)
    expect(await deletedProduct.json()).toEqual({ success: true })
    expect(await prisma.product.findUnique({ where: { id: firstBody.product.id } })).toBeNull()

    const restaurantPayload = {
      slug: 'krasny-prospekt', name: 'Чашка кофе на Красном проспекте', format: 'CITY', area: 'CITY',
      isAtApartHotel: false, coffeePickupEnabled: true, city: 'Новосибирск', address: 'Красный проспект, 25', phone: '+7 383 000-00-00',
      description: null, aboutTitle: 'О ресторане', aboutText: 'Тестовое описание ресторана.', visitAmenities: [{ iconUrl: '/images/wifi.svg', title: 'Wi-Fi', description: 'Для гостей доступен беспроводной интернет.' }], coverImageUrl: null, galleryUrls: [], menuPdfUrl: null, latitude: null, longitude: null, yandexMapsUrl: null, twoGisUrl: null,
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
      weightGrams: 220, measurementUnit: 'GRAM', priceKopecks: 59000, calories: null, proteins: null, fats: null, carbohydrates: null,
      isVegetarian: true, isSpicy: false, isLactoseFree: false, isGlutenFree: false, isLight: false,
      marketingBadge: 'NEW', imageUrl: null, position: 10,
    }
    const importedMenu = await app.request('/api/admin/menus/import', {
      method: 'POST', headers, body: JSON.stringify({
        menu: { slug: 'imported-menu', name: 'Импортированное меню', description: null },
        categories: [{ slug: 'coffee', name: 'Кофе', position: 10, items: [{ ...itemPayload, slug: 'cappuccino', name: 'Капучино' }] }],
      }),
    })
    const importedMenuBody = await importedMenu.json()
    expect(importedMenu.status).toBe(201)
    expect(importedMenuBody.menu).toMatchObject({ slug: 'imported-menu', categoryCount: 1, restaurantCount: 0 })
    const importedDetail = await app.request(`/api/admin/menus/${importedMenuBody.menu.id}/detail`, { headers })
    expect(await importedDetail.json()).toMatchObject({ categories: [{ slug: 'coffee', items: [{ slug: 'cappuccino', name: 'Капучино' }] }] })

    const item = await app.request(`/api/admin/categories/${categoryBody.id}/items`, {
      method: 'POST', headers, body: JSON.stringify(itemPayload),
    })
    const itemBody = await item.json()
    expect(item.status).toBe(201)
    const allergen = await prisma.allergen.upsert({ where: { slug: 'nuts' }, create: { slug: 'nuts', name: 'Орехи' }, update: {} })
    await prisma.menuItemAllergen.create({ data: { menuItemId: itemBody.id, allergenId: allergen.id } })

    const copiedMenu = await app.request(`/api/admin/menus/${menuBody.menu.id}/copy`, { method: 'POST', headers })
    const copiedMenuBody = await copiedMenu.json()
    expect(copiedMenu.status).toBe(201)
    expect(copiedMenuBody.menu).toMatchObject({ name: 'Основное меню — копия', slug: 'main-menu-copy', categoryCount: 1, restaurantCount: 0 })

    const copiedMenuDetail = await app.request(`/api/admin/menus/${copiedMenuBody.menu.id}/detail`, { headers })
    const copiedMenuDetailBody = await copiedMenuDetail.json()
    expect(copiedMenuDetail.status).toBe(200)
    expect(copiedMenuDetailBody.categories).toHaveLength(1)
    expect(copiedMenuDetailBody.categories[0]).toMatchObject({ slug: 'breakfasts', name: 'Завтраки' })
    expect(copiedMenuDetailBody.categories[0].id).not.toBe(categoryBody.id)
    expect(copiedMenuDetailBody.categories[0].items[0]).toMatchObject(itemPayload)
    expect(copiedMenuDetailBody.categories[0].items[0].id).not.toBe(itemBody.id)
    expect(await prisma.menuItemAllergen.count({ where: { menuItemId: copiedMenuDetailBody.categories[0].items[0].id, allergenId: allergen.id } })).toBe(1)

    const copiedMenuAgain = await app.request(`/api/admin/menus/${menuBody.menu.id}/copy`, { method: 'POST', headers })
    expect(await copiedMenuAgain.json()).toMatchObject({ menu: { name: 'Основное меню — копия 2', slug: 'main-menu-copy-2' } })

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

  test('publishes scheduled content when due and records admin history and bulk updates', async () => {
    await createUser('workspace@example.com', 'password123', 'Контент', ['SUPER_ADMIN'])
    const login = await app.request('/api/auth/token/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'workspace@example.com', password: 'password123' }),
    })
    const { accessToken } = await login.json()
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    const contentPayload = {
      type: 'PROMOTION', status: 'SCHEDULED', publishAt: new Date(Date.now() + 86_400_000).toISOString(), slug: 'scheduled-breakfast', title: 'Завтрак по расписанию',
      excerpt: null, body: null, blocks: [], imageUrl: null, ctaLabel: null, ctaUrl: null, startsAt: null, endsAt: null,
      eventStartsAt: null, location: null, priceKopecks: null, registrationEnabled: false, isFeatured: false, position: 10,
    }

    const created = await app.request('/api/admin/content', { method: 'POST', headers, body: JSON.stringify(contentPayload) })
    const createdBody = await created.json()
    expect(created.status).toBe(201)

    const beforeSchedule = await app.request('/api/content?type=PROMOTION')
    expect((await beforeSchedule.json()).entries).toHaveLength(0)

    const duePayload = { ...contentPayload, publishAt: new Date(Date.now() - 60_000).toISOString() }
    const updated = await app.request(`/api/admin/content/${createdBody.entry.id}`, { method: 'PUT', headers, body: JSON.stringify(duePayload) })
    expect(updated.status).toBe(200)
    const afterSchedule = await app.request('/api/content?type=PROMOTION')
    expect((await afterSchedule.json()).entries[0]?.title).toBe('Завтрак по расписанию')

    const bulk = await app.request('/api/admin/workspace/bulk-status', {
      method: 'POST', headers,
      body: JSON.stringify({ resource: 'CONTENT', ids: [createdBody.entry.id], status: 'ARCHIVED' }),
    })
    expect(await bulk.json()).toEqual({ updated: 1 })

    const workspace = await app.request('/api/admin/workspace', { headers })
    const workspaceBody = await workspace.json()
    expect(workspace.status).toBe(200)
    expect(workspaceBody.recentActivity.map((event: { action: string }) => event.action)).toEqual(expect.arrayContaining(['CREATE', 'UPDATE', 'BULK_UPDATE']))

    const search = await app.request('/api/admin/workspace/search?q=Завтрак', { headers })
    expect((await search.json()).results[0]).toMatchObject({ resource: 'CONTENT', title: 'Завтрак по расписанию', status: 'ARCHIVED' })
  })

  test('saves application choices in the admin API and exposes them on the public page', async () => {
    await createUser('pages@example.com', 'password123', 'Редактор страниц', ['CONTENT_MANAGER'])
    const login = await app.request('/api/auth/token/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pages@example.com', password: 'password123' }),
    })
    const { accessToken } = await login.json()
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    const appChoices = [{
      id: '018f8d94-1f4f-7000-8000-000000000201',
      label: 'Заказать',
      title: 'Выбрать ресторан и заказать',
      description: 'Доставка или самовывоз из ближайшей «Чашки».',
      imageUrl: '/images/app/order-screen.webp',
      imageAlt: 'Главный экран приложения с выбором ресторана',
    }]

    const saved = await app.request('/api/admin/pages/APP', {
      method: 'PUT', headers,
      body: JSON.stringify({
        key: 'APP', title: 'Приложение', heroTitle: 'Вся «Чашка»', heroDescription: 'Всё внутри.',
        heroImageUrl: '/images/app/hero.webp', coffeeTastes: null, appChoices, blocks: [],
      }),
    })
    expect(saved.status).toBe(200)
    expect((await saved.json()).page.appChoices).toEqual(appChoices)

    const publicPage = await app.request('/api/pages/APP')
    expect(publicPage.status).toBe(200)
    expect((await publicPage.json()).page.appChoices).toEqual(appChoices)

    expect(await prisma.websiteBuildState.findUnique({ where: { id: 'global' } })).toMatchObject({
      requestedVersion: 1,
      completedVersion: 0,
      status: 'QUEUED',
    })
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

  async function createUser(email: string, password = 'password123', displayName: string | null = null, roles: UserRole[] = ['CATALOG_MANAGER']) {
    return prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        displayName,
        role: roles.includes('SUPER_ADMIN') ? 'ADMIN' : 'EDITOR',
        roles,
      },
    })
  }
})
