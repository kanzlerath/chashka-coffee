import { describe, expect, test } from 'bun:test'

import {
  createCrmCustomerNoteRequestSchema,
  createCrmTagRequestSchema,
  crmCustomerListQuerySchema,
  setCrmCustomerTagsRequestSchema,
  updateCrmCustomerRequestSchema,
} from './index'

describe('CRM contracts', () => {
  test('normalizes customer list filters and bounds pagination', () => {
    expect(crmCustomerListQuerySchema.parse({ q: '  Анна  ', page: '2', pageSize: '25', segment: 'REPEAT' })).toEqual({
      q: 'Анна', page: 2, pageSize: 25, status: 'ACTIVE', segment: 'REPEAT', sort: 'LAST_ORDER_DESC',
    })
    expect(() => crmCustomerListQuerySchema.parse({ pageSize: '101' })).toThrow()
  })

  test('validates customer edits, notes and tags', () => {
    expect(updateCrmCustomerRequestSchema.parse({ name: ' Анна ', email: '', status: 'ACTIVE' })).toEqual({
      name: 'Анна', email: null, status: 'ACTIVE',
    })
    expect(createCrmCustomerNoteRequestSchema.parse({ body: '  Любит фильтр-кофе  ' })).toEqual({ body: 'Любит фильтр-кофе' })
    expect(createCrmTagRequestSchema.parse({ name: ' VIP ', color: '#A44A3F' })).toEqual({ name: 'VIP', color: '#a44a3f' })
    expect(setCrmCustomerTagsRequestSchema.parse({ tagIds: ['550e8400-e29b-41d4-a716-446655440000'] }).tagIds).toHaveLength(1)
    expect(() => setCrmCustomerTagsRequestSchema.parse({ tagIds: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000'] })).toThrow()
  })
})
