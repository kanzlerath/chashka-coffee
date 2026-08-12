import { describe, expect, test } from 'bun:test'

import { availableVariants, productFromPrice } from '../src/lib/product-presentation'

describe('cake product presentation', () => {
  const variants = [
    { id: 'first', label: 'С яблоками', weightGrams: null, priceKopecks: 9_000, position: 10, isAvailable: true },
    { id: 'second', label: 'С ягодами', weightGrams: null, priceKopecks: 8_000, position: 20, isAvailable: true },
    { id: 'third', label: 'С рыбой', weightGrams: null, priceKopecks: 19_000, position: 30, isAvailable: false },
  ]

  test('shows the lowest available price instead of the first variant price', () => {
    expect(productFromPrice({ variants })).toBe(8_000)
  })

  test('keeps all variants visible when none is marked as available yet', () => {
    const unavailable = variants.map((variant) => ({ ...variant, isAvailable: false }))
    expect(availableVariants({ variants: unavailable })).toHaveLength(3)
  })
})
