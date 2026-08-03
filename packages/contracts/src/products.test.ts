import { describe, expect, test } from 'bun:test'

import { upsertProductRequestSchema } from './products'

describe('product catalog contracts', () => {
  test('models coffee with selectable weight variants and editorial details', () => {
    const product = upsertProductRequestSchema.parse({
      type: 'COFFEE',
      status: 'PUBLISHED',
      slug: 'ethiopia-guji',
      name: 'Эфиопия Гуджи',
      category: null,
      subtitle: 'Светлая обжарка',
      description: 'Яркий и сочный кофе.',
      ingredients: null,
      origin: 'Эфиопия',
      roastLevel: 'Светлая',
      tastingNotes: ['бергамот', 'персик', 'какао'],
      imageUrl: '/images/coffee.webp',
      galleryUrls: ['/images/coffee-detail.webp'],
      details: [{ label: 'Обработка', value: 'Натуральная' }],
      isFeatured: true,
      position: 10,
      variants: [
        { label: '250 г', weightGrams: 250, priceKopecks: 89000, position: 10, isAvailable: true },
        { label: '1 кг', weightGrams: 1000, priceKopecks: 289000, position: 20, isAvailable: true },
      ],
    })

    expect(product.variants).toHaveLength(2)
    expect(product.tastingNotes[0]).toBe('бергамот')
  })

  test('rejects products without a purchasable presentation', () => {
    expect(() => upsertProductRequestSchema.parse({
      type: 'CAKE', status: 'DRAFT', slug: 'cake', name: 'Торт', category: 'Торты', subtitle: null, description: null,
      ingredients: null, origin: null, roastLevel: null, tastingNotes: [], imageUrl: null, galleryUrls: [],
      details: [], isFeatured: false, position: 10, variants: [],
    })).toThrow()
  })

  test('keeps category optional for existing product writers', () => {
    const parsed = upsertProductRequestSchema.parse({
      type: 'COFFEE', status: 'DRAFT', slug: 'legacy-coffee', name: 'Старый клиент',
      subtitle: null, description: null, ingredients: null, origin: null, roastLevel: null,
      tastingNotes: [], imageUrl: null, galleryUrls: [], details: [], isFeatured: false, position: 10,
      variants: [{ label: '250 г', weightGrams: 250, priceKopecks: 79000, position: 10, isAvailable: true }],
    })

    expect(parsed.category).toBeUndefined()
  })
})
