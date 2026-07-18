import type { ContentEntry, JobOpening, RestaurantSummary } from '@chashka-coffee/contracts'

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
  return uniqueSlugs([...fallback, ...(response?.restaurants.map(({ slug }) => slug) ?? [])])
}
