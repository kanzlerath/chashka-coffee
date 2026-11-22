export type SeoOverride = { title: string | null; description: string | null; seoImageUrl?: string | null }

export function resolveSeoMetadata(base: { title: string; description: string; image: string }, override: SeoOverride | null) {
  const title = override?.title?.trim() || base.title
  const description = override?.description?.trim() || base.description
  return { title, description, shareTitle: title, shareDescription: description, image: override?.seoImageUrl?.trim() || base.image }
}
