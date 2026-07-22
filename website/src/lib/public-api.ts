import type { ContentEntry, JobOpening, ManagedPage, ManagedPageKey, Product, ProductType, RestaurantSummary } from '@chashka-coffee/contracts'

const apiOrigin = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000'

const uniqueSlugs = (slugs: string[]) => [...new Set(slugs.filter(Boolean))]

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiOrigin}${path}`)
    return response.ok ? await response.json() as T : null
  } catch {
    return null
  }
}

export async function getContentSlugs(type: ContentEntry['type'], fallback: string[]) {
  const response = await getJson<{ entries: Pick<ContentEntry, 'slug'>[] }>(`/api/content?type=${type}`)
  return uniqueSlugs([...fallback, ...(response?.entries.map(({ slug }) => slug) ?? [])])
}

export async function getJobSlugs(fallback: string[]) {
  const response = await getJson<{ openings: Pick<JobOpening, 'slug'>[] }>('/api/jobs')
  return uniqueSlugs([...fallback, ...(response?.openings.map(({ slug }) => slug) ?? [])])
}

export async function getRestaurantSlugs(fallback: string[]) {
  const response = await getJson<{ restaurants: Pick<RestaurantSummary, 'slug'>[] }>('/api/restaurants')
  return response
    ? uniqueSlugs(response.restaurants.map(({ slug }) => slug))
    : uniqueSlugs(fallback)
}

export async function getRestaurantMenuSlugs(fallback: string[]) {
  const response = await getJson<{ restaurants: Pick<RestaurantSummary, 'slug' | 'hasMenu'>[] }>('/api/restaurants')
  return response
    ? uniqueSlugs(response.restaurants.filter(({ hasMenu }) => hasMenu).map(({ slug }) => slug))
    : uniqueSlugs(fallback)
}

export async function getProducts(type: ProductType) {
  const response = await getJson<{ products: Product[] }>(`/api/products?type=${type}`)
  return response?.products ?? []
}

export async function getProduct(slug: string) {
  const response = await getJson<{ product: Product }>(`/api/products/${slug}`)
  return response?.product ?? null
}

export async function getProductSlugs(type: ProductType, fallback: string[]) {
  const products = await getProducts(type)
  return uniqueSlugs([...fallback, ...products.map(({ slug }) => slug)])
}

export async function getManagedPage(key: ManagedPageKey) {
  const response = await getJson<{ page: ManagedPage }>(`/api/pages/${key}`)
  return response?.page ?? null
}

export async function getContent(type: ContentEntry['type']) {
  const response = await getJson<{ entries: ContentEntry[] }>(`/api/content?type=${type}`)
  return response?.entries ?? []
}

export async function getContentEntry(type: ContentEntry['type'], slug: string) {
  void type
  const response = await getJson<{ entry: ContentEntry }>(`/api/content/${slug}`)
  return response?.entry ?? null
}
