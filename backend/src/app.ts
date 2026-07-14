import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import type { DbClient } from './db'
import type { AppEnv } from './env'
import { errorResponse, handleError, validationErrorHook } from './http/errors'
import { createAuthModule, type AuthHttpEnv } from './modules/auth'
import { createCatalogModule } from './modules/catalog'

type CreateAppOptions = {
  env: AppEnv
  prisma: DbClient
}

export function createApp({ env, prisma }: CreateAppOptions) {
  const auth = createAuthModule({ db: prisma, env })
  const catalog = createCatalogModule({ db: prisma })
  const app = new OpenAPIHono<AuthHttpEnv>({
    defaultHook: validationErrorHook,
  })

  app.use(secureHeaders())
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return env.CORS_ORIGINS[0] ?? null
        return env.CORS_ORIGINS.includes(origin) ? origin : null
      },
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
      maxAge: 600,
    }),
  )
  app.get('/', (c) => {
    return c.json({
      name: 'chashka_coffee backend',
      status: 'ok',
    })
  })

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
    })
  })

  app.route('/api/auth', auth.routes)
  app.route('/api/restaurants', catalog.routes)

  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'chashka_coffee API',
      version: '1.0.0',
    },
  })

  app.notFound((c) => c.json(errorResponse('NOT_FOUND', 'Route not found'), 404))
  app.onError(handleError)

  return app
}

export type AppType = ReturnType<typeof createApp>
