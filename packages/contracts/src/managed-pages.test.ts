import { describe, expect, test } from 'bun:test'

import { upsertManagedPageRequestSchema } from './managed-pages'

describe('managed marketing pages', () => {
  test('accepts stable page keys with reorderable visible blocks', () => {
    const page = upsertManagedPageRequestSchema.parse({
      key: 'DELIVERY',
      title: 'Доставка',
      heroTitle: 'Любимое\nприедет.',
      heroDescription: 'Для медленного утра и вечера дома.',
      heroImageUrl: '/images/delivery.webp',
      coffeeTastes: null,
      blocks: [{
        id: '018f8d94-1f4f-7000-8000-000000000001',
        type: 'CTA',
        isVisible: true,
        title: 'Закажите любимое',
        text: 'Привезём из ближайшего ресторана.',
        label: 'Перейти к доставке',
        url: 'https://eda.yandex.ru',
      }],
    })

    expect(page.key).toBe('DELIVERY')
    expect(page.heroTitle).toBe('Любимое\nприедет.')
    expect(page.blocks[0]?.type).toBe('CTA')
  })

  test('stores an editable coffee taste accordion', () => {
    const page = upsertManagedPageRequestSchema.parse({
      key: 'COFFEE',
      title: 'Кофе',
      heroTitle: 'Кофе —\nнаша работа.',
      heroDescription: 'Настраиваем вкус каждый день.',
      heroImageUrl: '/images/coffee.webp',
      coffeeTastes: [{
        title: 'Абрикос',
        description: 'Сочная сладость и мягкая кислотность.',
        imageUrl: '/images/apricot.webp',
      }],
      blocks: [],
    })

    expect(page.coffeeTastes?.[0]?.title).toBe('Абрикос')
  })

  test('keeps new hero fields optional for existing admin clients', () => {
    const page = upsertManagedPageRequestSchema.parse({
      key: 'ABOUT',
      title: 'О нас',
      blocks: [],
    })

    expect(page.heroTitle).toBeUndefined()
    expect(page.coffeeTastes).toBeUndefined()
  })
})
