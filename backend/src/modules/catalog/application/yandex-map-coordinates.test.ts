import { describe, expect, test } from 'bun:test'

import { extractYandexMapCoordinates, resolveYandexMapCoordinates } from './yandex-map-coordinates'

describe('Yandex Maps coordinates', () => {
  test('extracts latitude and longitude from a full Yandex Maps link without a request', async () => {
    let requestCount = 0
    const coordinates = await resolveYandexMapCoordinates(
      'https://yandex.ru/maps/?ll=82.942771%2C55.048636',
      async () => {
        requestCount += 1
        return new Response(null, { status: 200 })
      },
    )

    expect(coordinates).toEqual({ latitude: 55.048636, longitude: 82.942771 })
    expect(requestCount).toBe(0)
  })

  test('follows a short Yandex Maps link and extracts coordinates from its redirect', async () => {
    const coordinates = await resolveYandexMapCoordinates(
      'https://yandex.ru/maps/-/CTSaE0Pb',
      async () => new Response(null, {
        status: 301,
        headers: { location: '/maps/org/chashka_kofe/?ll=82.942771%2C55.048636' },
      }),
    )

    expect(coordinates).toEqual({ latitude: 55.048636, longitude: 82.942771 })
  })

  test('does not request arbitrary URLs or follow redirects away from Yandex Maps', async () => {
    const fetcher = async () => new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/?ll=82.942771%2C55.048636' },
    })

    await expect(resolveYandexMapCoordinates('https://example.com/?ll=82.942771%2C55.048636', fetcher)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Поддерживаются только ссылки Яндекс Карт.',
    })
    await expect(resolveYandexMapCoordinates('https://yandex.ru/maps/-/CTSaE0Pb', fetcher)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Поддерживаются только ссылки Яндекс Карт.',
    })
  })

  test('rejects invalid coordinate values', () => {
    expect(extractYandexMapCoordinates(new URL('https://yandex.ru/maps/?ll=182%2C95'))).toBeNull()
  })
})
