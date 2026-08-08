import { AppError } from '../../../http/errors'

type Coordinates = { latitude: number; longitude: number }
type YandexMapFetcher = (input: string, init?: RequestInit) => Promise<Pick<Response, 'headers' | 'status'>>

const maxRedirects = 3
const requestTimeoutMs = 5_000

function invalidYandexMapLink(message = 'Укажите ссылку из Яндекс Карт.') {
  return new AppError(400, 'VALIDATION_ERROR', message)
}

function isAllowedYandexMapUrl(url: URL) {
  return url.protocol === 'https:'
    && (url.hostname === 'yandex.ru' || url.hostname.endsWith('.yandex.ru'))
    && url.pathname.startsWith('/maps')
}

function assertAllowedYandexMapUrl(url: URL) {
  if (!isAllowedYandexMapUrl(url)) {
    throw invalidYandexMapLink('Поддерживаются только ссылки Яндекс Карт.')
  }
}

export function extractYandexMapCoordinates(url: URL): Coordinates | null {
  const ll = url.searchParams.get('ll')
  if (!ll) return null

  const [longitudeRaw, latitudeRaw, ...extra] = ll.split(',')
  if (!longitudeRaw || !latitudeRaw || extra.length > 0) return null

  const longitude = Number(longitudeRaw)
  const latitude = Number(latitudeRaw)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }

  return { latitude, longitude }
}

export async function resolveYandexMapCoordinates(value: string, fetcher: YandexMapFetcher = fetch): Promise<Coordinates> {
  let currentUrl: URL
  try {
    currentUrl = new URL(value)
  } catch {
    throw invalidYandexMapLink()
  }

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    assertAllowedYandexMapUrl(currentUrl)
    const coordinates = extractYandexMapCoordinates(currentUrl)
    if (coordinates) return coordinates

    let response: Pick<Response, 'headers' | 'status'>
    try {
      response = await fetcher(currentUrl.href, {
        redirect: 'manual',
        signal: AbortSignal.timeout(requestTimeoutMs),
      })
    } catch {
      throw invalidYandexMapLink('Не удалось открыть ссылку Яндекс Карт. Попробуйте ещё раз.')
    }

    const location = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || !location) break

    try {
      currentUrl = new URL(location, currentUrl)
    } catch {
      throw invalidYandexMapLink()
    }
  }

  throw invalidYandexMapLink('В ссылке Яндекс Карт не удалось найти координаты.')
}
