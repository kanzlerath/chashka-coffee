import { describe, expect, test } from 'bun:test'

import { selectStaticSlugs } from '../src/lib/public-api'

describe('static route slugs', () => {
  test('uses API slugs exclusively when the API responded', () => {
    expect(selectStaticSlugs(['fallback-page'], ['published-page', 'published-page'])).toEqual(['published-page'])
  })

  test('keeps editorial fallbacks only while the API is unavailable', () => {
    expect(selectStaticSlugs(['fallback-page', 'fallback-page'], null)).toEqual(['fallback-page'])
  })

  test('does not generate ghost routes for a valid empty API response', () => {
    expect(selectStaticSlugs(['fallback-page'], [])).toEqual([])
  })
})
