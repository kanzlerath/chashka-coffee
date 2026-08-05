import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'

import { handleError } from '../../../http/errors'
import { AuthFailure } from '../domain/errors'
import { createRequireAuth, createRequirePermission, type AuthHttpEnv } from './middleware'

describe('requireAuth middleware', () => {
  test('rejects missing and invalid bearer tokens', async () => {
    const app = createProtectedTestApp()

    const missing = await app.request('/protected')
    expect(missing.status).toBe(401)

    const invalid = await app.request('/protected', {
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(invalid.status).toBe(401)
  })

  test('sets typed authenticated principal for downstream handlers', async () => {
    const app = createProtectedTestApp()
    const response = await app.request('/protected', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      email: 'user@example.com',
      sessionId: 'session-1',
      userId: 'user-1',
    })
  })
})

function createProtectedTestApp() {
  const app = new Hono<AuthHttpEnv>()
  const requireAuth = createRequireAuth(async (accessToken) => {
    if (accessToken !== 'valid-token') {
      throw new AuthFailure('access_token_invalid', 'Access token is invalid or expired')
    }

    return {
      id: 'user-1',
      email: 'user@example.com',
      displayName: null,
      roles: ['CATALOG_MANAGER'],
      createdAt: '2026-01-01T00:00:00.000Z',
      sessionId: 'session-1',
    }
  })

  app.use('*', requireAuth)
  app.get('/protected', (c) => {
    const user = c.var.user
    return c.json({
      email: user.email,
      sessionId: user.sessionId,
      userId: user.id,
    })
  })
  app.onError(handleError)

  return app
}

describe('requirePermission middleware', () => {
  test('allows only principals whose assigned roles grant the permission', async () => {
    const app = new Hono<AuthHttpEnv>()
    app.use('*', async (c, next) => {
      c.set('user', {
        id: 'user-1',
        email: 'user@example.com',
        displayName: null,
        roles: c.req.header('x-role') === 'super' ? ['SUPER_ADMIN'] : ['ORDER_OPERATOR'],
        createdAt: '2026-01-01T00:00:00.000Z',
        sessionId: 'session-1',
      })
      await next()
    })
    app.use('*', createRequirePermission('STAFF_MANAGE'))
    app.get('/', (c) => c.json({ ok: true }))
    app.onError(handleError)

    expect((await app.request('/')).status).toBe(403)
    expect((await app.request('/', { headers: { 'x-role': 'super' } })).status).toBe(200)
  })
})
