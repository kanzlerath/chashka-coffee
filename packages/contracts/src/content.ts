import { z } from 'zod'

const uuid = z.uuid()
const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const nullableText = (max: number) => z.string().trim().max(max).nullable()
const publicUrl = z.string().trim().min(1).max(2_048).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), 'Expected an absolute URL or a site-relative path')
const nullableUrl = publicUrl.nullable()

const richTextTags = new Set(['a', 'b', 'blockquote', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'i', 'li', 'ol', 'p', 's', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'])
const richTextVoidTags = new Set(['br'])

/**
 * Keeps editorial HTML portable between the React editor, API and Astro renderer.
 * Unknown elements and all attributes except safe links are removed.
 */
export function sanitizeRichText(value: string) {
  let result = ''
  let cursor = 0
  const tagPattern = /<[^>]*>/g

  for (const match of value.matchAll(tagPattern)) {
    const index = match.index ?? 0
    result += escapeRichTextText(value.slice(cursor, index))
    result += sanitizeRichTextTag(match[0])
    cursor = index + match[0].length
  }

  return result + escapeRichTextText(value.slice(cursor))
}

function sanitizeRichTextTag(rawTag: string) {
  if (/^<!--/.test(rawTag)) return ''

  const closing = rawTag.match(/^<\s*\/\s*([a-z0-9]+)\s*>$/i)
  if (closing) {
    const tag = closing[1].toLowerCase()
    return richTextTags.has(tag) && !richTextVoidTags.has(tag) ? `</${tag}>` : ''
  }

  const opening = rawTag.match(/^<\s*([a-z0-9]+)([\s\S]*?)\/?\s*>$/i)
  if (!opening) return ''
  const tag = opening[1].toLowerCase()
  if (!richTextTags.has(tag)) return ''
  if (richTextVoidTags.has(tag)) return `<${tag}>`
  if (tag !== 'a') return `<${tag}>`

  const hrefMatch = opening[2].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i)
  const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3]
  if (!href || !isSafeRichTextUrl(href)) return '<a>'
  const safeHref = escapeRichTextAttribute(href)
  return /^https?:\/\//i.test(href)
    ? `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">`
    : `<a href="${safeHref}">`
}

function isSafeRichTextUrl(value: string) {
  return value.startsWith('/') || /^https?:\/\//i.test(value)
}

function escapeRichTextText(value: string) {
  return value
    .replace(/&(?!(?:amp|lt|gt|quot|#39|nbsp|#\d+|#x[a-f0-9]+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeRichTextAttribute(value: string) {
  return escapeRichTextText(value).replace(/"/g, '&quot;')
}

const richText = (max: number) => z.string().trim().min(1).max(max).transform(sanitizeRichText)
const nullableRichText = (max: number) => richText(max).nullable()

const blockBase = z.object({ id: uuid, isVisible: z.boolean() })
const galleryImageSchema = z.object({ url: publicUrl, alt: z.string().trim().min(1).max(240), caption: nullableText(300) }).strict()
export const galleryLayoutSchema = z.enum(['MOSAIC', 'GRID', 'CAROUSEL', 'FEATURED'])
export type GalleryLayout = z.infer<typeof galleryLayoutSchema>
export const textBlockLayoutSchema = z.enum(['STANDARD', 'LEAD', 'COLUMNS'])
export type TextBlockLayout = z.infer<typeof textBlockLayoutSchema>
export const imageBlockLayoutSchema = z.enum(['WIDE', 'INSET', 'PORTRAIT'])
export type ImageBlockLayout = z.infer<typeof imageBlockLayoutSchema>
export const splitBlockLayoutSchema = z.enum(['BALANCED', 'MEDIA_WIDE', 'TEXT_WIDE'])
export type SplitBlockLayout = z.infer<typeof splitBlockLayoutSchema>
export const quoteBlockStyleSchema = z.enum(['DARK', 'LIGHT', 'ACCENT'])
export type QuoteBlockStyle = z.infer<typeof quoteBlockStyleSchema>
export const videoBlockLayoutSchema = z.enum(['WIDE', 'INSET', 'CINEMA'])
export type VideoBlockLayout = z.infer<typeof videoBlockLayoutSchema>
export const ctaBlockStyleSchema = z.enum(['ACCENT', 'DARK', 'LIGHT'])
export type CtaBlockStyle = z.infer<typeof ctaBlockStyleSchema>
export const headingLevelSchema = z.enum(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])
export type HeadingLevel = z.infer<typeof headingLevelSchema>
export const editorialTextSizeSchema = z.enum(['SMALL', 'NORMAL', 'LARGE'])
export type EditorialTextSize = z.infer<typeof editorialTextSizeSchema>

export const contentBlockSchema = z.discriminatedUnion('type', [
  blockBase.extend({ type: z.literal('TEXT'), layout: textBlockLayoutSchema.optional(), title: nullableText(180), titleLevel: headingLevelSchema.optional(), textSize: editorialTextSizeSchema.optional(), text: richText(60_000) }).strict(),
  blockBase.extend({ type: z.literal('IMAGE'), layout: imageBlockLayoutSchema.optional(), imageUrl: publicUrl, alt: z.string().trim().min(1).max(240), caption: nullableText(300) }).strict(),
  blockBase.extend({ type: z.literal('SPLIT'), layout: splitBlockLayoutSchema.optional(), title: z.string().trim().min(1).max(180), titleLevel: headingLevelSchema.optional(), textSize: editorialTextSizeSchema.optional(), text: richText(30_000), imageUrl: publicUrl, alt: z.string().trim().min(1).max(240), imagePosition: z.enum(['LEFT', 'RIGHT']) }).strict(),
  blockBase.extend({ type: z.literal('GALLERY'), layout: galleryLayoutSchema.optional(), images: z.array(galleryImageSchema).min(1).max(12) }).strict(),
  blockBase.extend({ type: z.literal('QUOTE'), style: quoteBlockStyleSchema.optional(), textSize: editorialTextSizeSchema.optional(), text: richText(8_000), attribution: nullableText(180) }).strict(),
  blockBase.extend({ type: z.literal('VIDEO'), layout: videoBlockLayoutSchema.optional(), videoUrl: publicUrl, posterUrl: nullableUrl, title: nullableText(180) }).strict(),
  blockBase.extend({ type: z.literal('CTA'), style: ctaBlockStyleSchema.optional(), title: z.string().trim().min(1).max(180), titleLevel: headingLevelSchema.optional(), textSize: editorialTextSizeSchema.optional(), text: nullableRichText(8_000), label: z.string().trim().min(1).max(80), url: publicUrl }).strict(),
])
export type ContentBlock = z.infer<typeof contentBlockSchema>
export const contentBlockListSchema = z.array(contentBlockSchema).max(80)

export const contentEntryTypeSchema = z.enum(['PROMOTION', 'EVENT', 'ARTICLE'])
export type ContentEntryType = z.infer<typeof contentEntryTypeSchema>
export const publicationStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])
export type PublicationStatus = z.infer<typeof publicationStatusSchema>
export const contentEntrySchema = z.object({
  id: uuid, type: contentEntryTypeSchema, status: publicationStatusSchema, slug,
  title: z.string().trim().min(1).max(180), excerpt: nullableText(500), body: nullableText(20_000), blocks: contentBlockListSchema, imageUrl: nullableUrl,
  ctaLabel: nullableText(80), ctaUrl: nullableUrl, startsAt: z.string().datetime().nullable(), endsAt: z.string().datetime().nullable(),
  publishAt: z.string().datetime().nullable().default(null),
  eventStartsAt: z.string().datetime().nullable(), location: nullableText(220), priceKopecks: z.number().int().nonnegative().nullable(), registrationEnabled: z.boolean(), isFeatured: z.boolean(), position: z.number().int().nonnegative(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
})
export type ContentEntry = z.infer<typeof contentEntrySchema>
export const upsertContentEntryRequestSchema = contentEntrySchema.omit({ id: true, createdAt: true, updatedAt: true }).strict()
export type UpsertContentEntryRequest = z.infer<typeof upsertContentEntryRequestSchema>
export const contentEntryListResponseSchema = z.object({ entries: z.array(contentEntrySchema) })
export const contentEntryResponseSchema = z.object({ entry: contentEntrySchema })
