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

  test('stores editable application choices with their phone screens', () => {
    const page = upsertManagedPageRequestSchema.parse({
      key: 'APP',
      title: 'Приложение',
      heroTitle: 'Вся «Чашка»\nв вашем телефоне',
      heroDescription: 'Заказывайте и копите бонусы.',
      heroImageUrl: '/images/app/hero.webp',
      coffeeTastes: null,
      appChoices: [{
        id: '018f8d94-1f4f-7000-8000-000000000002',
        label: 'Заказать',
        title: 'Выбрать ресторан и заказать',
        description: 'Доставка или самовывоз из ближайшей «Чашки».',
        imageUrl: '/images/app/order-screen.webp',
        imageAlt: 'Главный экран приложения с выбором ресторана',
      }],
      blocks: [],
    })

    expect(page.appChoices?.[0]?.label).toBe('Заказать')
    expect(page.appChoices?.[0]?.imageUrl).toBe('/images/app/order-screen.webp')
  })

  test('keeps new hero fields optional for existing admin clients', () => {
    const page = upsertManagedPageRequestSchema.parse({
      key: 'ABOUT',
      title: 'О нас',
      blocks: [],
    })

    expect(page.heroTitle).toBeUndefined()
    expect(page.coffeeTastes).toBeUndefined()
    expect(page.appChoices).toBeUndefined()
  })
})
