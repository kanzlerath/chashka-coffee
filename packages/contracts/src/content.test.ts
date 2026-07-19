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
