import { describe, expect, test } from 'bun:test'

import {
  restaurantMenuResponseSchema,
  restaurantDetailResponseSchema,
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
      hasMenu: true,
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
        hasMenu: true,
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
      hasMenu: true,
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
        hasMenu: true,
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

  test('exposes the complete public restaurant profile for a detail page', () => {
    const detail = restaurantDetailResponseSchema.parse({
      restaurant: {
        id: '018f8d94-1f4f-7000-8000-000000000001', slug: 'krasny-prospekt', name: 'Чашка кофе', format: 'CITY', area: 'CITY', isAtApartHotel: false,
        city: 'Новосибирск', address: 'Красный проспект, 25', phone: '+7 (383) 123-20-20', openingHoursLabel: 'Пн–Вс: 08:00–22:00', hasMenu: true, coverImageUrl: null,
        description: 'Кофейня в центре города.', latitude: 55.03, longitude: 82.92, yandexMapsUrl: null, twoGisUrl: null,
        aboutTitle: 'Место для встреч в центре',
        aboutText: 'Большой светлый зал, открытая кухня и спокойная музыка. Здесь удобно встречаться утром и оставаться до вечера.',
        visitAmenities: [
          { iconUrl: '/images/location-pin.svg', title: 'Парковка рядом', description: 'Бесплатная парковка во дворе ресторана.' },
          { iconUrl: 'https://media.example.test/icons/pet-friendly.svg', title: 'Можно с собакой', description: 'Будем рады гостям с воспитанными питомцами.' },
        ],
        menuPdfUrl: 'https://media.example.test/restaurants/krasny-prospekt-menu.pdf',
        galleryUrls: [
          'https://media.example.test/restaurants/krasny-prospekt-1.webp',
          'https://media.example.test/restaurants/krasny-prospekt-2.webp',
        ],
        openingHours: [{ dayOfWeek: 1, opensAt: '08:00', closesAt: '22:00', isClosed: false }], scheduleExceptions: [],
      },
    })

    expect(detail.restaurant.description).toBe('Кофейня в центре города.')
    expect(detail.restaurant.aboutTitle).toBe('Место для встреч в центре')
    expect(detail.restaurant.aboutText).toContain('открытая кухня')
    expect(detail.restaurant.visitAmenities[0]?.title).toBe('Парковка рядом')
    expect(detail.restaurant.visitAmenities[1]?.iconUrl).toEndWith('pet-friendly.svg')
    expect(detail.restaurant.menuPdfUrl).toEndWith('krasny-prospekt-menu.pdf')
    expect(detail.restaurant.galleryUrls).toHaveLength(2)
  })
})
