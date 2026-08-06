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
import { createHomepageModule } from './modules/homepage'
import { createProductsModule } from './modules/products'
import { createManagedPagesModule } from './modules/managed-pages'
import { createAnalyticsModule } from './modules/analytics'
import { createWorkspaceModule } from './modules/workspace'
import { createCustomerAccountModule, type PremiumBonusGateway } from './modules/customer-account'
import { createOrdersModule } from './modules/orders'
import { createCrmModule } from './modules/crm'
import { createOperationalNotificationsModule } from './modules/operational-notifications'
import { createSiteSettingsModule } from './modules/site-settings'

type CreateAppOptions = {
  env: AppEnv
  prisma: DbClient
  premiumBonusGateway?: PremiumBonusGateway
}

export function createApp({ env, prisma, premiumBonusGateway }: CreateAppOptions) {
  const auth = createAuthModule({ db: prisma, env })
  const catalog = createCatalogModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requirePermission('CATALOG_MANAGE') })
  const content = createContentModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requirePermission('CONTENT_MANAGE') })
  const media = createMediaModule({ db: prisma, env, requireAuth: auth.requireAuth, requireAdmin: auth.requirePermission('MEDIA_MANAGE') })
  const notifications = createOperationalNotificationsModule({ db: prisma, env, requireAuth: auth.requireAuth, requireAdmin: auth.requirePermission('STAFF_MANAGE') })
  const leads = createLeadsModule({ db: prisma, requireAuth: auth.requireAuth, requireLeadAccess: auth.requireAnyPermission(['LEADS_MANAGE', 'JOB_APPLICATIONS_MANAGE']), notifications: notifications.service })
  const jobs = createJobsModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requirePermission('JOBS_MANAGE') })
  const homepage = createHomepageModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requirePermission('CONTENT_MANAGE') })
  const products = createProductsModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requirePermission('CATALOG_MANAGE') })
  const managedPages = createManagedPagesModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requirePermission('CONTENT_MANAGE') })
  const siteSettings = createSiteSettingsModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requirePermission('CONTENT_MANAGE') })
  const analytics = createAnalyticsModule({ db: prisma, requireAuth: auth.requireAuth, requireAdmin: auth.requirePermission('ANALYTICS_READ') })
  const workspace = createWorkspaceModule({ db: prisma, requireAuth: auth.requireAuth })
  const customerAccount = createCustomerAccountModule({ db: prisma, env, gateway: premiumBonusGateway })
  const orders = createOrdersModule({ db: prisma, env, requireAuth: auth.requireAuth, requireOrderAccess: auth.requirePermission('ORDERS_MANAGE'), resolveCustomerId: customerAccount.resolveCustomerId, notifications: notifications.service })
  const crm = createCrmModule({ db: prisma, requireAuth: auth.requireAuth, requireCustomerRead: auth.requirePermission('CUSTOMERS_READ') })
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
  app.route('/api/customer', customerAccount.routes)
  app.route('/api/customer', orders.customerRoutes)
  app.route('/api/store', orders.storeRoutes)
  app.use('/api/admin/*', auth.requireAuth, workspace.auditMiddleware)
  app.route('/api/admin', auth.adminRoutes)
  app.route('/api/restaurants', catalog.routes)
  app.route('/api/content', content.routes)
  app.route('/api/homepage', homepage.routes)
  app.route('/api/leads', leads.routes)
  app.route('/api/jobs', jobs.routes)
  app.route('/api/products', products.routes)
  app.route('/api/pages', managedPages.routes)
  app.route('/api/site-settings', siteSettings.routes)
  app.route('/api/analytics', analytics.routes)
  app.route('/api/admin', catalog.adminRoutes)
  app.route('/api/admin', content.adminRoutes)
  app.route('/api/admin', homepage.adminRoutes)
  app.route('/api/admin', leads.adminRoutes)
  app.route('/api/admin', jobs.adminRoutes)
  app.route('/api/admin', media)
  app.route('/api/admin', products.adminRoutes)
  app.route('/api/admin', managedPages.adminRoutes)
  app.route('/api/admin', siteSettings.adminRoutes)
  app.route('/api/admin', analytics.adminRoutes)
  app.route('/api/admin', workspace.adminRoutes)
  app.route('/api/admin', orders.adminRoutes)
  app.route('/api/admin', crm)
  app.route('/api/admin', notifications.adminRoutes)

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
