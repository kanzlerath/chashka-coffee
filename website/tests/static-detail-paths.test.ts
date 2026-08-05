import { describe, expect, test } from 'bun:test'
import type { ContentEntry, Product } from '@chashka-coffee/contracts'

import { createContentStaticPaths, createProductStaticPaths } from '../src/lib/static-detail-paths'

describe('static detail routes', () => {
  test('passes published content into its detail route without another API request', () => {
    const entries = [
      { slug: 'first-story', title: 'First story' },
      { slug: 'second-story', title: 'Second story' },
    ] as ContentEntry[]

    expect(createContentStaticPaths(entries)).toEqual([
      { params: { slug: 'first-story' }, props: { entry: entries[0] } },
      { params: { slug: 'second-story' }, props: { entry: entries[1] } },
    ])
  })

  test('passes products and their related catalogue items into detail routes', () => {
    const products = [
      { slug: 'ethiopia', name: 'Ethiopia' },
      { slug: 'brazil', name: 'Brazil' },
      { slug: 'colombia', name: 'Colombia' },
    ] as Product[]

    expect(createProductStaticPaths(products)).toEqual([
      { params: { slug: 'ethiopia' }, props: { product: products[0], related: [products[1], products[2]] } },
      { params: { slug: 'brazil' }, props: { product: products[1], related: [products[0], products[2]] } },
      { params: { slug: 'colombia' }, props: { product: products[2], related: [products[0], products[1]] } },
    ])
  })
})
