import { describe, expect, test } from 'bun:test'

import { importCakeProductsRequestSchema, upsertProductRequestSchema } from './products'

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
      blocks: [{
        id: '018f20e8-38e4-7a65-9aa5-77e1d8613a11',
        type: 'TEXT',
        isVisible: true,
        title: 'Как раскрывается вкус',
        text: '<p>Лучше всего — в фильтре.</p>',
      }],
      isFeatured: true,
      position: 10,
      variants: [
        { label: '250 г', weightGrams: 250, priceKopecks: 89000, position: 10, isAvailable: true },
        { label: '1 кг', weightGrams: 1000, priceKopecks: 289000, position: 20, isAvailable: true },
      ],
    })

    expect(product.variants).toHaveLength(2)
    expect(product.tastingNotes[0]).toBe('бергамот')
    expect(product.blocks).toMatchObject([{ type: 'TEXT', title: 'Как раскрывается вкус' }])
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

  test('accepts only new cake drafts in an atomic import', () => {
    const cake = {
      type: 'CAKE', status: 'DRAFT', publishAt: null, slug: 'medovik', name: 'Медовик', category: 'Торты', subtitle: null, description: null,
      ingredients: null, origin: null, roastLevel: null, tastingNotes: [], imageUrl: null, galleryUrls: [], details: [], blocks: [], isFeatured: false, position: 10,
      variants: [{ label: '1 кг', weightGrams: 1000, priceKopecks: 250000, position: 10, isAvailable: true }],
    }
    expect(importCakeProductsRequestSchema.parse({ products: [cake] }).products).toHaveLength(1)
    expect(() => importCakeProductsRequestSchema.parse({ products: [cake, cake] })).toThrow()
  })
})
