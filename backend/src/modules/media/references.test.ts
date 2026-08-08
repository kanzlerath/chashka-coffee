import { describe, expect, test } from 'bun:test'

import { valueReferencesMediaUrl } from './references'

describe('media references', () => {
  const publicUrl = '/uploads/media/2026/08/latte.png'

  test('finds media URLs inside structured editor data', () => {
    expect(valueReferencesMediaUrl({ image: publicUrl, nested: [{ url: '/uploads/media/other.png' }] }, publicUrl)).toBe(true)
    expect(valueReferencesMediaUrl([['/uploads/media/other.png']], publicUrl)).toBe(false)
  })
})
