import { describe, expect, test } from 'bun:test'

import { homepageBestsellerMenuItemSchema, upsertHomepageSlideRequestSchema } from './homepage'

describe('homepage contracts', () => {
  const slide = {
    mediaType: 'VIDEO',
    mediaUrl: '/uploads/summer-drink.mp4',
    posterUrl: '/uploads/summer-drink.webp',
    eyebrow: 'Летняя коллекция',
    title: 'Холодный кофе\nдля долгого дня',
    description: 'Новая коллекция напитков уже во всех кофейнях.',
    ctaLabel: 'Посмотреть меню',
    ctaUrl: '/restaurants/krasny-prospekt/menu',
    durationSeconds: 8,
    isPublished: true,
    position: 10,
  }

  test('accepts configured image and video slides for the public homepage', () => {
    expect(upsertHomepageSlideRequestSchema.parse(slide)).toMatchObject({
      mediaType: 'VIDEO',
      mediaUrl: '/uploads/summer-drink.mp4',
      durationSeconds: 8,
    })
  })

  test('rejects untrusted media and CTA URLs', () => {
    expect(() => upsertHomepageSlideRequestSchema.parse({ ...slide, mediaUrl: 'javascript:alert(1)' })).toThrow()
    expect(() => upsertHomepageSlideRequestSchema.parse({ ...slide, ctaUrl: 'ftp://media.example.test/coffee' })).toThrow()
  })

  test('exposes a bestseller output when the catalogue item has one', () => {
    expect(homepageBestsellerMenuItemSchema.parse({
      id: '019a2f17-453e-7c1a-9c04-4e468e7eb514',
      slug: 'cappuccino',
      name: 'Капучино',
      description: 'Кофе с молоком',
      weightGrams: 320,
      priceKopecks: 29000,
      imageUrl: '/images/cappuccino.png',
      marketingBadge: 'HIT',
      categoryName: 'Кофе',
    })).toMatchObject({ weightGrams: 320 })
  })
})
