import {
  apiErrorSchema,
  customerLogoutRequestSchema,
  customerQrResponseSchema,
  customerSendCodeRequestSchema,
  customerSendCodeResponseSchema,
  customerSessionResponseSchema,
  customerVerifyCodeRequestSchema,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import type { AppEnv } from '../../../env'
import { AppError, validationErrorHook } from '../../../http/errors'
import type { CustomerAccountService } from '../application/customer-account-service'
import { executeCustomerAccount } from './errors'

const customerSessionCookieName = 'chashka_customer_session'

const errorContent = { 'application/json': { schema: apiErrorSchema } }

const sendCodeRoute = createRoute({
  method: 'post',
  path: '/auth/code',
  request: { body: { content: { 'application/json': { schema: customerSendCodeRequestSchema } } } },
  responses: {
    202: { content: { 'application/json': { schema: customerSendCodeResponseSchema } }, description: 'SMS code sent' },
    400: { content: errorContent, description: 'Invalid payload' },
    403: { content: errorContent, description: 'Customer is blocked or origin is untrusted' },
    404: { content: errorContent, description: 'Customer is not registered' },
    429: { content: errorContent, description: 'Code sending is throttled' },
    503: { content: errorContent, description: 'PremiumBonus is unavailable' },
  },
})

const verifyCodeRoute = createRoute({
  method: 'post',
  path: '/auth/verify',
  request: { body: { content: { 'application/json': { schema: customerVerifyCodeRequestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: customerSessionResponseSchema } }, description: 'Customer session created' },
    400: { content: errorContent, description: 'Invalid or expired code' },
    403: { content: errorContent, description: 'Customer is blocked or origin is untrusted' },
    429: { content: errorContent, description: 'Too many attempts' },
    503: { content: errorContent, description: 'PremiumBonus is unavailable' },
  },
})

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  responses: {
    200: { content: { 'application/json': { schema: customerSessionResponseSchema } }, description: 'Current customer profile' },
    401: { content: errorContent, description: 'Customer session is missing or expired' },
    403: { content: errorContent, description: 'Customer is blocked' },
    503: { content: errorContent, description: 'PremiumBonus is unavailable' },
  },
})

const qrRoute = createRoute({
  method: 'post',
  path: '/qr',
  request: { body: { content: { 'application/json': { schema: customerLogoutRequestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: customerQrResponseSchema } }, description: 'Fresh PremiumBonus customer code' },
    401: { content: errorContent, description: 'Customer session is missing or expired' },
    403: { content: errorContent, description: 'Customer is blocked or origin is untrusted' },
    503: { content: errorContent, description: 'PremiumBonus is unavailable' },
  },
})

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  request: { body: { content: { 'application/json': { schema: customerLogoutRequestSchema } } } },
  responses: {
    204: { description: 'Customer session revoked' },
    403: { content: errorContent, description: 'Origin is untrusted' },
  },
})

export function createCustomerAccountRoutes({ env, service }: {
  env: AppEnv
  service: CustomerAccountService
}) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })

  routes.openapi(sendCodeRoute, async (c) => {
    assertTrustedOrigin(c, env)
    const response = await executeCustomerAccount(() => service.sendLoginCode(c.req.valid('json').phone))
    c.header('Cache-Control', 'no-store')
    return c.json(response, 202)
  })

  routes.openapi(verifyCodeRoute, async (c) => {
    assertTrustedOrigin(c, env)
    const input = c.req.valid('json')
    const result = await executeCustomerAccount(() => service.verifyLoginCode({
      ...input,
      metadata: requestMetadata(c),
    }))
    setCustomerSessionCookie(c, result.sessionToken, result.sessionExpiresAt, env)
    c.header('Cache-Control', 'no-store')
    return c.json({ customer: result.customer }, 200)
  })

  routes.openapi(meRoute, async (c) => {
    const customer = await executeCustomerAccount(() => service.getProfile(getCustomerSessionCookie(c)))
    c.header('Cache-Control', 'no-store')
    return c.json({ customer }, 200)
  })

  routes.openapi(qrRoute, async (c) => {
    assertTrustedOrigin(c, env)
    const response = await executeCustomerAccount(() => service.generateQrCode(getCustomerSessionCookie(c)))
    c.header('Cache-Control', 'no-store')
    return c.json(response, 200)
  })

  routes.openapi(logoutRoute, async (c) => {
    assertTrustedOrigin(c, env)
    await executeCustomerAccount(() => service.logout(getCustomerSessionCookie(c)))
    deleteCustomerSessionCookie(c, env)
    return c.body(null, 204)
  })

  return routes
}

function requestMetadata(c: Context) {
  const forwardedFor = c.req.header('x-forwarded-for')
  return {
    userAgent: c.req.header('user-agent'),
    ipAddress: forwardedFor?.split(',')[0]?.trim(),
  }
}

function assertTrustedOrigin(c: Context, env: AppEnv) {
  if (!env.COOKIE_SECURE) return
  const origin = c.req.header('origin')
  if (origin && env.CORS_ORIGINS.includes(origin)) return
  throw new AppError(403, 'FORBIDDEN', 'Customer account requests require a trusted Origin')
}

function getCustomerSessionCookie(c: Context) {
  return getCookie(c, customerSessionCookieName)
}

function setCustomerSessionCookie(c: Context, token: string, expiresAt: Date, env: AppEnv) {
  setCookie(c, customerSessionCookieName, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SECURE ? 'None' : 'Lax',
    path: '/api/customer',
    expires: expiresAt,
    maxAge: 7 * 24 * 60 * 60,
  })
}

function deleteCustomerSessionCookie(c: Context, env: AppEnv) {
  deleteCookie(c, customerSessionCookieName, {
    path: '/api/customer',
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SECURE ? 'None' : 'Lax',
  })
}

