import { describe, expect, test } from 'bun:test'

import { responsePublishesPublicContent, shouldRequestPublicWebsiteBuild } from './queue'

describe('public website build queue', () => {
  test('queues mutations that can change generated public pages', () => {
    for (const resource of ['restaurants', 'menus', 'categories', 'items', 'content', 'homepage', 'products', 'pages', 'site-settings', 'jobs', 'workspace']) {
      expect(shouldRequestPublicWebsiteBuild(resource)).toBe(true)
    }
  })

  test('does not rebuild the public site for an unattached media upload or lead workflow', () => {
    expect(shouldRequestPublicWebsiteBuild('media')).toBe(false)
    expect(shouldRequestPublicWebsiteBuild('leads')).toBe(false)
  })

  test('rebuilds only published entries from draft-capable editors', () => {
    expect(responsePublishesPublicContent({ product: { status: 'DRAFT' } })).toBe(false)
    expect(responsePublishesPublicContent({ entry: { status: 'SCHEDULED' } })).toBe(false)
    expect(responsePublishesPublicContent({ opening: { status: 'PUBLISHED' } })).toBe(true)
  })
})
