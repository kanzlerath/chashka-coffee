import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import type { DbClient } from './db'
import type { AppEnv } from './env'
import { errorResponse, handleError, validationErrorHook } from './http/errors'
import { createAuthModule, type AuthHttpEnv } from './modules/auth'
import { createCatalogModule } from './modules/catalog'
import { createContentModule } from './modules/content'
import { createLeadsModule } from './modules/leads'
import { createMediaModule } from './modules/media'
import { createJobsModule } from './modules/jobs'

type CreateAppOptions = {
  env: AppEnv
  prisma: DbClient
}

export function createApp({ env, prisma }: CreateAppOptions) {
  const auth = createAuthModule({ db: prisma, env })
  const catalog = createCatalogModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requireAdmin })
  const content = createContentModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requireAdmin })
  const media = createMediaModule({ db: prisma, env, requireAuth: auth.requireAuth, requireAdmin: auth.requireAdmin })
  const leads = createLeadsModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requireAdmin })
  const jobs = createJobsModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requireAdmin })
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
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
  app.route('/api/admin', auth.adminRoutes)
  app.route('/api/restaurants', catalog.routes)
  app.route('/api/content', content.routes)
  app.route('/api/leads', leads.routes)
  app.route('/api/jobs', jobs.routes)
  app.route('/api/admin', catalog.adminRoutes)
  app.route('/api/admin', content.adminRoutes)
  app.route('/api/admin', leads.adminRoutes)
  app.route('/api/admin', jobs.adminRoutes)
  app.route('/api/admin', media)

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
