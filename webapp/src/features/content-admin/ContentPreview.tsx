import { sanitizeRichText, type ContentBlock, type HeadingLevel } from '@chashka-coffee/contracts'
import type { MouseEvent, ReactNode } from 'react'

import { Typography } from '@/components/ui/typography'
import { resolveAdminImagePreview } from '@/features/media-admin/media-utils'

type ContentPreviewProps = {
  blocks: ContentBlock[]
  title?: string
  excerpt?: string | null
  imageUrl?: string | null
}

const variantClass = (prefix: string, value: string) => `${prefix}-${value.toLowerCase().replaceAll('_', '-')}`
const heading = (level: HeadingLevel | undefined, children: ReactNode) => {
  const tag = (level ?? 'H2').toLowerCase() as Lowercase<HeadingLevel>
  return <Typography as={tag} variant={tag}>{children}</Typography>
}
const richHtml = (value: string) => ({ __html: sanitizeRichText(value) })
const preventNavigation = (event: MouseEvent<HTMLAnchorElement>) => event.preventDefault()

export function ContentPreview({ blocks, title, excerpt, imageUrl }: ContentPreviewProps) {
  const visible = blocks.filter((block) => block.isVisible)

  return <section aria-label="Итоговый предпросмотр" className="admin-content-preview">
    <div className="admin-preview-browser"><i /><i /><i /><Typography as="span" variant="caption">Предпросмотр страницы</Typography></div>
    <article className="admin-preview-page">
      {(title || excerpt || imageUrl) ? <header className="admin-preview-hero">
        <div><Typography as="small" variant="caption">Материал</Typography><Typography as="h1" variant="h1">{title || 'Заголовок материала'}</Typography>{excerpt ? <Typography variant="bodySm">{excerpt}</Typography> : null}</div>
        {imageUrl ? <img alt="" src={resolveAdminImagePreview(imageUrl)} /> : <Typography aria-hidden="true" as="div" className="admin-preview-cover-placeholder" variant="caption">Обложка</Typography>}
      </header> : null}
      <div className="admin-preview-blocks">
        {visible.map((block) => <PreviewBlock block={block} key={block.id} />)}
        {visible.length === 0 ? <Typography className="admin-preview-empty" variant="bodySm">Добавьте и включите хотя бы один блок — здесь появится итоговая страница.</Typography> : null}
      </div>
    </article>
  </section>
}

function PreviewBlock({ block }: { block: ContentBlock }) {
  if (block.type === 'TEXT') {
    return <section className={`admin-preview-text ${variantClass('admin-preview-text', block.layout ?? 'STANDARD')} ${variantClass('admin-preview-copy', block.textSize ?? 'NORMAL')}`}>
      <Typography as="div" variant="body">{block.title ? heading(block.titleLevel, block.title) : null}<div className="admin-preview-rich" dangerouslySetInnerHTML={richHtml(block.text)} /></Typography>
    </section>
  }
  if (block.type === 'IMAGE') return <figure className={`admin-preview-image ${variantClass('admin-preview-image', block.layout ?? 'WIDE')}`}><img alt={block.alt} src={resolveAdminImagePreview(block.imageUrl)} />{block.caption ? <Typography as="figcaption" variant="caption">{block.caption}</Typography> : null}</figure>
  if (block.type === 'SPLIT') {
    return <section className={`admin-preview-split ${variantClass('admin-preview-split', block.layout ?? 'BALANCED')} ${variantClass('admin-preview-copy', block.textSize ?? 'NORMAL')} ${block.imagePosition === 'LEFT' ? 'is-reverse' : ''}`}>
      <Typography as="div" variant="body">{heading(block.titleLevel, block.title)}<div className="admin-preview-rich" dangerouslySetInnerHTML={richHtml(block.text)} /></Typography><img alt={block.alt} src={resolveAdminImagePreview(block.imageUrl)} />
    </section>
  }
  if (block.type === 'GALLERY') return <section className={`admin-preview-gallery ${variantClass('admin-preview-gallery', block.layout ?? 'MOSAIC')}`}>{block.images.map((image, index) => <figure key={`${block.id}-${index}`}><img alt={image.alt} src={resolveAdminImagePreview(image.url)} />{image.caption ? <Typography as="figcaption" variant="caption">{image.caption}</Typography> : null}</figure>)}</section>
  if (block.type === 'QUOTE') return <Typography asChild variant="body"><blockquote className={`admin-preview-quote ${variantClass('admin-preview-quote', block.style ?? 'DARK')} ${variantClass('admin-preview-copy', block.textSize ?? 'NORMAL')}`}><div className="admin-preview-rich" dangerouslySetInnerHTML={richHtml(block.text)} />{block.attribution ? <Typography as="cite" variant="caption">{block.attribution}</Typography> : null}</blockquote></Typography>
  if (block.type === 'VIDEO') return <section className={`admin-preview-video ${variantClass('admin-preview-video', block.layout ?? 'WIDE')}`}><video controls poster={block.posterUrl ?? undefined} src={block.videoUrl} />{block.title ? <Typography variant="bodySm">{block.title}</Typography> : null}</section>

  return <section className={`admin-preview-cta ${variantClass('admin-preview-cta', block.style ?? 'ACCENT')} ${variantClass('admin-preview-copy', block.textSize ?? 'NORMAL')}`}><Typography as="div" variant="body">{heading(block.titleLevel, block.title)}{block.text ? <div className="admin-preview-rich" dangerouslySetInnerHTML={richHtml(block.text)} /> : null}</Typography><a href={block.url} onClick={preventNavigation}><Typography as="span" variant="controlXs">{block.label}</Typography></a></section>
}
