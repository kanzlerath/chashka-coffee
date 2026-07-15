import {
  createLeadRequestSchema,
  leadListResponseSchema,
  leadResponseSchema,
  leadStatusSchema,
  leadTypeSchema,
  updateLeadStatusRequestSchema,
  type Lead,
} from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { DbClient } from '../../db'
import { AppError, validationErrorHook } from '../../http/errors'
import type { AuthHttpEnv } from '../auth'

const idParams = z.object({ id: z.uuid() })
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })
const errorContent = { 'application/json': { schema: errorSchema } }

type DatabaseLead = {
  id: string
  type: 'CONTACT' | 'RESERVATION' | 'FRANCHISE' | 'BANQUET' | 'JOB'
  status: 'NEW' | 'IN_PROGRESS' | 'CLOSED'
  name: string
  phone: string | null
  email: string | null
  message: string | null
  payload: unknown
  createdAt: Date
  updatedAt: Date
}

function dto(lead: DatabaseLead): Lead {
  return {
    id: lead.id,
    type: lead.type,
    status: lead.status,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    message: lead.message,
    metadata: readMetadata(lead.payload),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }
}

function readMetadata(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  return entries.length ? Object.fromEntries(entries) : null
}

export function createLeadsModule({ db, requireAuth, requireAdmin }: { db: DbClient; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono({ defaultHook: validationErrorHook })
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('*', requireAuth, requireAdmin)

  const submit = createRoute({
    method: 'post', path: '/',
    request: { body: { content: { 'application/json': { schema: createLeadRequestSchema } } } },
    responses: { 201: { content: { 'application/json': { schema: leadResponseSchema } }, description: 'Lead accepted' } },
  })
  const list = createRoute({
    method: 'get', path: '/leads',
    request: { query: z.object({ type: leadTypeSchema.optional(), status: leadStatusSchema.optional() }) },
    responses: { 200: { content: { 'application/json': { schema: leadListResponseSchema } }, description: 'Leads' } },
  })
  const updateStatus = createRoute({
    method: 'put', path: '/leads/{id}/status',
    request: { params: idParams, body: { content: { 'application/json': { schema: updateLeadStatusRequestSchema } } } },
    responses: {
      200: { content: { 'application/json': { schema: leadResponseSchema } }, description: 'Lead status updated' },
      404: { content: errorContent, description: 'Lead not found' },
    },
  })

  routes.openapi(submit, async (c) => {
    const input = c.req.valid('json')
    const { metadata, ...data } = input
    const lead = await db.lead.create({ data: { ...data, payload: metadata ?? undefined } })
    return c.json({ lead: dto(lead) }, 201)
  })
  adminRoutes.openapi(list, async (c) => {
    const { type, status } = c.req.valid('query')
    const leads = await db.lead.findMany({ where: { ...(type ? { type } : {}), ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' } })
    return c.json({ leads: leads.map(dto) }, 200)
  })
  adminRoutes.openapi(updateStatus, async (c) => {
    try {
      const lead = await db.lead.update({ where: { id: c.req.valid('param').id }, data: c.req.valid('json') })
      return c.json({ lead: dto(lead) }, 200)
    } catch {
      throw new AppError(404, 'NOT_FOUND', 'Lead not found')
    }
  })

  return { routes, adminRoutes }
}
