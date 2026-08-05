import { describe, expect, test } from 'bun:test'

import { classifyAdminMutation } from './index'

describe('admin audit classification', () => {
  test('classifies entity writes without retaining query strings', () => {
    expect(classifyAdminMutation('POST', '/api/admin/content')).toEqual({ action: 'CREATE', resource: 'content', resourceId: null })
    expect(classifyAdminMutation('PUT', '/api/admin/content/018f8d94-1f4f-7000-8000-000000000001?draft=1')).toEqual({ action: 'UPDATE', resource: 'content', resourceId: '018f8d94-1f4f-7000-8000-000000000001' })
    expect(classifyAdminMutation('DELETE', '/api/admin/jobs/018f8d94-1f4f-7000-8000-000000000001')).toEqual({ action: 'DELETE', resource: 'jobs', resourceId: '018f8d94-1f4f-7000-8000-000000000001' })
    expect(classifyAdminMutation('POST', '/api/admin/workspace/bulk-status')).toEqual({ action: 'BULK_UPDATE', resource: 'workspace', resourceId: null })
  })

  test('ignores reads and non-admin paths', () => {
    expect(classifyAdminMutation('GET', '/api/admin/content')).toBeNull()
    expect(classifyAdminMutation('POST', '/api/leads')).toBeNull()
  })
})
