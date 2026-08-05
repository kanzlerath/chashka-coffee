import { describe, expect, test } from 'bun:test'

import {
  adminActivityResponseSchema,
  adminBulkUpdateRequestSchema,
  adminSearchResponseSchema,
  adminWorkspaceResponseSchema,
} from './workspace'

const id = '018f8d94-1f4f-7000-8000-000000000001'

describe('admin workspace contracts', () => {
  test('accepts actionable queues, search results and durable activity', () => {
    expect(adminWorkspaceResponseSchema.parse({
      queues: [{ key: 'NEW_LEADS', label: 'Новые заявки', count: 3, href: '/leads?status=NEW', tone: 'URGENT' }],
      recentActivity: [{ id, actorId: id, actorName: 'Анна', action: 'UPDATE', resource: 'content', resourceId: id, path: `/api/admin/content/${id}`, createdAt: '2026-08-03T09:00:00.000Z' }],
    }).queues).toHaveLength(1)

    expect(adminSearchResponseSchema.parse({ results: [{ id, resource: 'CONTENT', title: 'Летнее меню', subtitle: 'Акция', href: `/content/promotions/${id}`, status: 'DRAFT', updatedAt: '2026-08-03T09:00:00.000Z' }] }).results[0]?.title).toBe('Летнее меню')
    expect(adminActivityResponseSchema.parse({ events: [] }).events).toEqual([])
  })

  test('allows only status transitions supported by the selected resource', () => {
    expect(adminBulkUpdateRequestSchema.parse({ resource: 'LEAD', ids: [id], status: 'CLOSED' }).status).toBe('CLOSED')
    expect(adminBulkUpdateRequestSchema.parse({ resource: 'PRODUCT', ids: [id], status: 'ARCHIVED' }).status).toBe('ARCHIVED')
    expect(() => adminBulkUpdateRequestSchema.parse({ resource: 'LEAD', ids: [id], status: 'PUBLISHED' })).toThrow()
    expect(() => adminBulkUpdateRequestSchema.parse({ resource: 'JOB', ids: [], status: 'DRAFT' })).toThrow()
  })
})
