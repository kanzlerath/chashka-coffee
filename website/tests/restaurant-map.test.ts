import { describe, expect, test } from 'bun:test'

import { getMapBounds, getMapCenter } from '../src/lib/restaurant-map'

const points = [
  { latitude: 55.0302, longitude: 82.9204 },
  { latitude: 54.8499, longitude: 83.1052 },
  { latitude: 55.0126, longitude: 82.6507 },
]

describe('restaurant map viewport', () => {
  test('builds the two-corner bounds shape expected by Yandex Maps', () => {
    expect(getMapBounds(points)).toEqual([
      [54.8499, 82.6507],
      [55.0302, 83.1052],
    ])
  })

  test('centers the initial viewport between the outermost coordinates', () => {
    expect(getMapCenter(points)).toEqual([54.94005, 82.87795])
  })
})
