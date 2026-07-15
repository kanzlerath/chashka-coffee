import { describe, expect, test } from 'bun:test'

import {
  restaurantMenuResponseSchema,
  upsertRestaurantScheduleExceptionRequestSchema,
  restaurantSummarySchema,
} from './catalog'

describe('restaurant catalog contracts', () => {
  test('accepts the restaurant data needed for the public directory', () => {
    const restaurant = restaurantSummarySchema.parse({
      id: '018f8d94-1f4f-7000-8000-000000000001',
      slug: 'krasny-prospekt',
      name: 'Чашка кофе — Красный проспект',
      format: 'CITY',
      area: 'CITY',
      isAtApartHotel: false,
      city: 'Новосибирск',
      address: 'Красный проспект, 25',
      phone: '+7 (383) 123-20-20',
      openingHoursLabel: 'Пн–Пт: 07:30–22:00',
      coverImageUrl: 'https://media.example.test/restaurants/krasny-prospekt.webp',
    })

    expect(restaurant.slug).toBe('krasny-prospekt')
  })

  test('keeps menu prices as integer kopecks and supports fixed dietary marks', () => {
    const menu = restaurantMenuResponseSchema.parse({
      restaurant: {
        id: '018f8d94-1f4f-7000-8000-000000000001',
        slug: 'krasny-prospekt',
        name: 'Чашка кофе — Красный проспект',
        format: 'CITY',
        area: 'CITY',
        isAtApartHotel: false,
        city: 'Новосибирск',
        address: 'Красный проспект, 25',
        phone: '+7 (383) 123-20-20',
        openingHoursLabel: 'Пн–Пт: 07:30–22:00',
        coverImageUrl: null,
      },
      menu: {
        id: '018f8d94-1f4f-7000-8000-000000000002',
        slug: 'city-core',
        name: 'Основное городское меню',
      },
      categories: [
        {
          id: '018f8d94-1f4f-7000-8000-000000000003',
          slug: 'breakfast',
          name: 'Завтраки',
          position: 10,
          items: [
            {
              id: '018f8d94-1f4f-7000-8000-000000000004',
              slug: 'avocado-toast',
              name: 'Тост с авокадо и яйцом пашот',
              description: 'Хрустящий хлеб, авокадо и яйцо пашот.',
              ingredients: 'Хлеб на закваске, авокадо, яйцо.',
              weightGrams: 220,
              priceKopecks: 55000,
              calories: 520,
              proteins: 18,
              fats: 27,
              carbohydrates: 46,
              allergens: ['Яйцо', 'Глютен'],
              dietaryMarks: ['VEGETARIAN'],
              marketingBadge: 'NEW',
              imageUrl: null,
            },
          ],
        },
      ],
    })

    expect(menu.categories[0]?.items[0]?.priceKopecks).toBe(55000)
  })

  test('rejects unsafe public slugs and fractional prices', () => {
    expect(() => restaurantSummarySchema.parse({
      id: '018f8d94-1f4f-7000-8000-000000000001',
      slug: '../restaurant',
      name: 'Чашка кофе',
      format: 'CITY',
      area: 'CITY',
      isAtApartHotel: false,
      city: 'Новосибирск',
      address: 'Красный проспект, 25',
      phone: '+7 (383) 123-20-20',
      openingHoursLabel: 'Ежедневно: 08:00–22:00',
      coverImageUrl: null,
    })).toThrow()

    expect(() => restaurantMenuResponseSchema.parse({
      restaurant: {
        id: '018f8d94-1f4f-7000-8000-000000000001',
        slug: 'krasny-prospekt',
        name: 'Чашка кофе',
        format: 'CITY',
        area: 'CITY',
        isAtApartHotel: false,
        city: 'Новосибирск',
        address: 'Красный проспект, 25',
        phone: '+7 (383) 123-20-20',
        openingHoursLabel: 'Ежедневно: 08:00–22:00',
        coverImageUrl: null,
      },
      menu: { id: '018f8d94-1f4f-7000-8000-000000000002', slug: 'city-core', name: 'Меню' },
      categories: [{
        id: '018f8d94-1f4f-7000-8000-000000000003',
        slug: 'breakfast',
        name: 'Завтраки',
        position: 10,
        items: [{
          id: '018f8d94-1f4f-7000-8000-000000000004',
          slug: 'toast',
          name: 'Тост',
          description: null,
          ingredients: null,
          weightGrams: null,
          priceKopecks: 550.5,
          calories: null,
          proteins: null,
          fats: null,
          carbohydrates: null,
          allergens: [],
          dietaryMarks: [],
          marketingBadge: null,
          imageUrl: null,
        }],
      }],
    })).toThrow()
  })

  test('models one-off restaurant opening-hour exceptions by calendar date', () => {
    expect(upsertRestaurantScheduleExceptionRequestSchema.parse({
      date: '2026-12-31',
      label: 'Новогодний график',
      opensAt: '09:00',
      closesAt: '18:00',
      isClosed: false,
    }).date).toBe('2026-12-31')

    expect(() => upsertRestaurantScheduleExceptionRequestSchema.parse({
      date: '31-12-2026', label: 'Некорректная дата', opensAt: null, closesAt: null, isClosed: true,
    })).toThrow()
  })
})
