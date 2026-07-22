import { describe, expect, test } from 'bun:test'
import type { RestaurantSummary } from '@chashka-coffee/contracts'
import { selectDefaultMenuRestaurant } from '../src/lib/default-menu'

const restaurant = (slug: string, hasMenu: boolean): RestaurantSummary => ({
  id: slug,
  slug,
  name: slug,
  address: `${slug}, 1`,
  area: 'CITY_CENTER',
  latitude: 55,
  longitude: 83,
  phone: null,
  openingHoursLabel: 'Ежедневно: 08:00–22:00',
  coverImageUrl: null,
  hasMenu,
})

describe('selectDefaultMenuRestaurant', () => {
  test('uses the first restaurant that currently has a menu', () => {
    const result = selectDefaultMenuRestaurant([
      restaurant('deleted-menu', false),
      restaurant('first-live-menu', true),
      restaurant('second-live-menu', true),
    ])

    expect(result?.slug).toBe('first-live-menu')
  })

  test('returns null when no restaurant has a menu', () => {
    expect(selectDefaultMenuRestaurant([restaurant('without-menu', false)])).toBeNull()
  })
})
