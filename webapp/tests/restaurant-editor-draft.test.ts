import { describe, expect, test } from 'bun:test'
import { upsertRestaurantRequestSchema, type AdminRestaurant } from '@chashka-coffee/contracts'

import { ApiRequestError } from '../src/platform/api/http-client'
import { restaurantSaveErrorMessage, restaurantToDraft } from '../src/features/catalog-admin/RestaurantsPage'

const restaurant: AdminRestaurant = {
  id: '018f8d94-1f4f-7000-8000-000000000001',
  slug: 'krasny-prospekt',
  name: 'Чашка кофе на Красном проспекте',
  format: 'CITY',
  area: 'CITY',
  isAtApartHotel: false,
  city: 'Новосибирск',
  address: 'Красный проспект, 25',
  phone: '+7 (383) 123-20-20',
  description: null,
  coverImageUrl: null,
  latitude: null,
  longitude: null,
  yandexMapsUrl: null,
  twoGisUrl: null,
  openingHours: [{ dayOfWeek: 0, opensAt: '08:00', closesAt: '22:00', isClosed: false }],
  menuId: '018f8d94-1f4f-7000-8000-000000000002',
  menuName: 'Основное меню',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
}

describe('restaurant editor draft', () => {
  test('contains only fields accepted by the restaurant update contract', () => {
    const draft = restaurantToDraft(restaurant)

    expect(() => upsertRestaurantRequestSchema.parse(draft)).not.toThrow()
    expect('menuId' in draft).toBe(false)
    expect('menuName' in draft).toBe(false)
  })

  test('names the field rejected by server validation', () => {
    const error = new ApiRequestError(400, 'VALIDATION_ERROR', 'Invalid request payload', [
      { code: 'too_small', path: ['address'], message: 'Too small' },
    ])

    expect(restaurantSaveErrorMessage(error)).toBe('Не удалось сохранить: проверьте поле «Адрес».')
  })
})
