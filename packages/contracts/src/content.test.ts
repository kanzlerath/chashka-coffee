import { describe, expect, test } from 'bun:test'

import { contentBlockListSchema, upsertContentEntryRequestSchema } from './content'

describe('managed content contracts', () => {
  test('accepts an ordered, reusable editorial document', () => {
    const blocks = contentBlockListSchema.parse([
      {
        id: '018f8d94-1f4f-7000-8000-000000000001',
        type: 'TEXT',
        isVisible: true,
        title: 'Как всё начиналось',
        text: 'История одного события.',
      },
      {
        id: '018f8d94-1f4f-7000-8000-000000000002',
        type: 'GALLERY',
        isVisible: true,
        images: [{ url: '/images/event.webp', alt: 'Гости события', caption: null }],
      },
    ])

    expect(blocks.map((block) => block.type)).toEqual(['TEXT', 'GALLERY'])
  })

  test('accepts gallery layouts while keeping old galleries compatible', () => {
    const layouts = ['MOSAIC', 'GRID', 'CAROUSEL', 'FEATURED'] as const

    for (const layout of layouts) {
      const [gallery] = contentBlockListSchema.parse([{
        id: '018f8d94-1f4f-7000-8000-000000000003',
        type: 'GALLERY',
        isVisible: true,
        layout,
        images: [{ url: '/images/event.webp', alt: 'Гости события', caption: null }],
      }])
      expect(gallery.type === 'GALLERY' && gallery.layout).toBe(layout)
    }

    expect(() => contentBlockListSchema.parse([{
      id: '018f8d94-1f4f-7000-8000-000000000004',
      type: 'GALLERY',
      isVisible: true,
      layout: 'BROKEN',
      images: [{ url: '/images/event.webp', alt: 'Гости события', caption: null }],
    }])).toThrow()
  })

  test('accepts presentation variants for every editorial block', () => {
    const blocks = contentBlockListSchema.parse([
      { id: '018f8d94-1f4f-7000-8000-000000000010', type: 'TEXT', isVisible: true, layout: 'COLUMNS', title: 'История', text: 'Текст' },
      { id: '018f8d94-1f4f-7000-8000-000000000011', type: 'IMAGE', isVisible: true, layout: 'PORTRAIT', imageUrl: '/images/event.webp', alt: 'Гости', caption: null },
      { id: '018f8d94-1f4f-7000-8000-000000000012', type: 'SPLIT', isVisible: true, layout: 'MEDIA_WIDE', title: 'Атмосфера', text: 'Текст', imageUrl: '/images/event.webp', alt: 'Зал', imagePosition: 'RIGHT' },
      { id: '018f8d94-1f4f-7000-8000-000000000013', type: 'QUOTE', isVisible: true, style: 'ACCENT', text: 'Цитата', attribution: null },
      { id: '018f8d94-1f4f-7000-8000-000000000014', type: 'VIDEO', isVisible: true, layout: 'CINEMA', videoUrl: '/video.mp4', posterUrl: null, title: null },
      { id: '018f8d94-1f4f-7000-8000-000000000015', type: 'CTA', isVisible: true, style: 'DARK', title: 'Заголовок', text: null, label: 'Подробнее', url: '/' },
    ])

    expect(blocks).toHaveLength(6)
  })

  test('rejects unknown presentation variants', () => {
    expect(() => contentBlockListSchema.parse([{
      id: '018f8d94-1f4f-7000-8000-000000000016',
      type: 'TEXT', isVisible: true, layout: 'FULLSCREEN', title: null, text: 'Текст',
    }])).toThrow()
  })

  test('keeps event price and registration behavior in the content contract', () => {
    const entry = upsertContentEntryRequestSchema.parse({
      type: 'EVENT',
      status: 'PUBLISHED',
      slug: 'coffee-evening',
      title: 'Кофейный вечер',
      excerpt: 'Пробуем новые лоты.',
      body: null,
      blocks: [],
      imageUrl: '/images/event.webp',
      ctaLabel: null,
      ctaUrl: null,
      startsAt: null,
      endsAt: null,
      eventStartsAt: '2026-08-10T16:00:00.000Z',
      location: 'Красный проспект, 25',
      priceKopecks: 250000,
      registrationEnabled: true,
      isFeatured: true,
      position: 10,
    })

    expect(entry.registrationEnabled).toBe(true)
    expect(entry.priceKopecks).toBe(250000)
  })
})
