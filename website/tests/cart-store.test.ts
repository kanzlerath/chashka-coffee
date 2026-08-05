import { describe, expect, test } from 'bun:test'

import { cartItemCount, cartTotal, normalizeCartLines } from '../src/lib/cart-store'

describe('coffee cart storage', () => {
  test('drops malformed entries and clamps quantities from persisted data', () => {
    const lines = normalizeCartLines([
      { variantId: 'v1', productSlug: 'coffee', productName: 'Кофе', variantLabel: '250 г', imageUrl: null, unitPriceKopecks: 89000, quantity: 99 },
      { variantId: 'v2', quantity: 1 },
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0]?.quantity).toBe(20)
  })

  test('calculates the optimistic counter and subtotal', () => {
    const lines = normalizeCartLines([
      { variantId: 'v1', productSlug: 'coffee', productName: 'Кофе', variantLabel: '250 г', imageUrl: null, unitPriceKopecks: 89000, quantity: 2 },
    ])
    expect(cartItemCount(lines)).toBe(2)
    expect(cartTotal(lines)).toBe(178000)
  })
})
