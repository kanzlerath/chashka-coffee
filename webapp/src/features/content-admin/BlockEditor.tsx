import type {
  ContentBlock,
  CtaBlockStyle,
  EditorialTextSize,
  GalleryLayout,
  HeadingLevel,
  ImageBlockLayout,
  QuoteBlockStyle,
  SplitBlockLayout,
  TextBlockLayout,
  VideoBlockLayout,
} from '@chashka-coffee/contracts'
import { cloneElement, isValidElement, useEffect, useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import { nullableDraftText } from '@/lib/form-drafts'
import { AdminImageField, AdminVideoField } from '@/features/media-admin'
import { ContentPreview } from './ContentPreview'
import { RichTextEditor } from './RichTextEditor'

const labels: Record<ContentBlock['type'], string> = {
  TEXT: 'Текст', IMAGE: 'Изображение', SPLIT: 'Текст + фото', GALLERY: 'Галерея',
  QUOTE: 'Цитата', VIDEO: 'Видео', CTA: 'Призыв к действию',
}

function createBlock(type: ContentBlock['type']): ContentBlock {
  const base = { id: crypto.randomUUID(), isVisible: true }
  if (type === 'TEXT') return { ...base, type, layout: 'STANDARD', title: null, titleLevel: 'H2', textSize: 'NORMAL', text: 'Новый текстовый блок' }
  if (type === 'IMAGE') return { ...base, type, layout: 'WIDE', imageUrl: '/images/home-morning-v2.png', alt: 'Описание изображения', caption: null }
  if (type === 'SPLIT') return { ...base, type, layout: 'BALANCED', title: 'Заголовок блока', titleLevel: 'H2', textSize: 'NORMAL', text: 'Текст блока', imageUrl: '/images/home-morning-v2.png', alt: 'Описание изображения', imagePosition: 'RIGHT' }
  if (type === 'GALLERY') return { ...base, type, layout: 'MOSAIC', images: [{ url: '/images/home-morning-v2.png', alt: 'Описание изображения', caption: null }] }
  if (type === 'QUOTE') return { ...base, type, style: 'DARK', textSize: 'NORMAL', text: 'Текст цитаты', attribution: null }
  if (type === 'VIDEO') return { ...base, type, layout: 'WIDE', videoUrl: '/video.mp4', posterUrl: null, title: null }
  return { ...base, type: 'CTA', style: 'ACCENT', title: 'Заголовок', titleLevel: 'H2', textSize: 'NORMAL', text: null, label: 'Подробнее', url: '/' }
}

function duplicateBlock(block: ContentBlock): ContentBlock {
  if (block.type === 'GALLERY') {
    return { ...block, id: crypto.randomUUID(), images: block.images.map((image) => ({ ...image })) }
  }
  return { ...block, id: crypto.randomUUID() }
}

type BlockEditorProps = {
  blocks: ContentBlock[]
  invalidBlockIds?: string[]
  onChange: (blocks: ContentBlock[]) => void
  preview?: { title?: string; excerpt?: string | null; imageUrl?: string | null }
}

export function BlockEditor({ blocks, invalidBlockIds = [], onChange, preview }: BlockEditorProps) {
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(() => blocks[0]?.id ?? null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const invalidBlockId = invalidBlockIds.find((id) => blocks.some((block) => block.id === id))
  const visibleExpandedBlockId = invalidBlockId ?? expandedBlockId

  useEffect(() => {
    if (!previewOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [previewOpen])

  const update = (index: number, block: ContentBlock) => onChange(blocks.map((current, currentIndex) => currentIndex === index ? block : current))
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return <section className="admin-block-editor">
    <div className="admin-block-toolbar">
      <div>
        <Typography as="strong" variant="bodySmMedium">Содержимое страницы</Typography>
        <Typography variant="caption">Редактируйте блоки сверху вниз. Готовые секции можно свернуть, чтобы быстрее перемещаться по материалу.</Typography>
      </div>
    </div>
    {blocks.length === 0 ? <Typography as="div" className="admin-block-empty" variant="bodySm">Здесь появится структура материала. Начните с текстового блока или связки текста с фотографией.</Typography> : null}
    <div className="admin-block-list">
      {blocks.map((block, index) => {
        const isExpanded = visibleExpandedBlockId === block.id
        const isInvalid = invalidBlockIds.includes(block.id)
        return <article aria-invalid={isInvalid || undefined} className="admin-block-card" data-collapsed={!isExpanded} key={block.id}>
        <header>
          <button
            aria-controls={`content-block-${block.id}`}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Свернуть' : 'Открыть'} блок ${String(index + 1).padStart(2, '0')}: ${labels[block.type]}`}
            className="admin-block-summary"
            type="button"
            onClick={() => setExpandedBlockId((current) => current === block.id ? null : block.id)}
          >
            <Typography as="span" className="admin-block-index" variant="caption">{String(index + 1).padStart(2, '0')}</Typography>
            <span className="admin-block-summary-copy"><Typography as="strong" variant="bodySmMedium">{labels[block.type]}</Typography><Typography as="small" className={isInvalid ? 'admin-state-error' : undefined} variant="caption">{isInvalid ? 'Проверьте обязательные поля блока' : blockSummary(block)}</Typography></span>
            <Typography aria-hidden="true" as="span" className="admin-block-chevron" variant="caption">⌄</Typography>
          </button>
          <div className="admin-block-actions">
            <label><input checked={block.isVisible} type="checkbox" onChange={(event) => update(index, { ...block, isVisible: event.target.checked })} /><Typography as="span" variant="caption">Показывать</Typography></label>
            <Button disabled={index === 0} size="sm" type="button" variant="ghost" onClick={() => move(index, -1)}>↑</Button>
            <Button disabled={index === blocks.length - 1} size="sm" type="button" variant="ghost" onClick={() => move(index, 1)}>↓</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => {
              const duplicate = duplicateBlock(block)
              setExpandedBlockId(duplicate.id)
              onChange([...blocks.slice(0, index + 1), duplicate, ...blocks.slice(index + 1)])
            }}>Дублировать</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => {
              if (expandedBlockId === block.id) setExpandedBlockId(null)
              onChange(blocks.filter((_, currentIndex) => currentIndex !== index))
            }}>Удалить</Button>
          </div>
        </header>
        {isExpanded ? <div className="admin-block-body" id={`content-block-${block.id}`}><BlockFields block={block} onChange={(next) => { setExpandedBlockId(block.id); update(index, next) }} /></div> : null}
      </article>})}
    </div>
    <div className="admin-add-block">
      <div><Typography as="strong" variant="bodySmMedium">Добавить блок</Typography><Typography variant="caption">Новый блок появится последним и сразу будет открыт для редактирования.</Typography></div>
      <select aria-label="Добавить блок" defaultValue="" onChange={(event) => {
        if (!event.target.value) return
        const block = createBlock(event.target.value as ContentBlock['type'])
        setExpandedBlockId(block.id)
        onChange([...blocks, block])
        event.target.value = ''
      }}>
        <option value="" disabled>Выберите тип блока…</option>
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    <div className="admin-preview-toggle">
      <div><Typography as="strong" variant="bodySmMedium">Итоговый предпросмотр</Typography><Typography variant="caption">Показывает только включённые блоки и обновляется вместе с черновиком.</Typography></div>
      <Button aria-expanded={previewOpen} type="button" variant="outline" onClick={() => setPreviewOpen((value) => !value)}>{previewOpen ? 'Закрыть предпросмотр' : 'Открыть предпросмотр'}</Button>
    </div>
    {previewOpen ? <div className="admin-preview-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false) }}>
      <section aria-labelledby="content-preview-title" aria-modal="true" className="admin-preview-modal" role="dialog">
        <header><div><Typography as="strong" id="content-preview-title" variant="bodySmMedium">Предпросмотр материала</Typography><Typography variant="caption">Так включённые блоки будут выглядеть на сайте.</Typography></div><Button autoFocus type="button" variant="outline" onClick={() => setPreviewOpen(false)}>Закрыть</Button></header>
        <div className="admin-preview-modal-body"><ContentPreview blocks={blocks} {...preview} /></div>
      </section>
    </div> : null}
  </section>
}

function blockSummary(block: ContentBlock) {
  if (block.type === 'IMAGE') return block.caption || block.alt
  if (block.type === 'GALLERY') return `${block.images.length} фото`
  if (block.type === 'VIDEO') return block.title || block.videoUrl
  if ('title' in block && block.title) return block.title
  if ('text' in block && block.text) return block.text.replace(/<[^>]+>/g, '').slice(0, 90)
  return 'Без названия'
}

function BlockFields({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  if (block.type === 'TEXT') return <div className="admin-block-fields">
    <PresentationPicker label="Композиция текста" hint="Миниатюры повторяют ширину, фон и положение текста на публичной странице." value={block.layout ?? 'STANDARD'} options={textLayouts} onChange={(layout) => onChange({ ...block, layout })} />
    <TextSettings headingLevel={block.titleLevel ?? 'H2'} textSize={block.textSize ?? 'NORMAL'} onHeadingLevel={(titleLevel) => onChange({ ...block, titleLevel })} onTextSize={(textSize) => onChange({ ...block, textSize })} />
    <div className="grid gap-3"><Field label="Заголовок"><Input value={block.title ?? ''} onChange={(event) => onChange({ ...block, title: event.target.value || null })} /></Field><Field label="Текст"><RichTextEditor ariaLabel="Текст блока" value={block.text} onChange={(text) => onChange({ ...block, text })} /></Field></div>
  </div>
  if (block.type === 'IMAGE') return <div className="admin-block-fields"><PresentationPicker label="Размер изображения" hint="Выберите, насколько сильно фотография должна доминировать на странице." value={block.layout ?? 'WIDE'} options={imageLayouts} onChange={(layout) => onChange({ ...block, layout })} /><div className="grid gap-3"><Field label="Изображение"><AdminImageField required value={block.imageUrl} onChange={(imageUrl) => imageUrl && onChange({ ...block, imageUrl })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Alt-текст"><Input value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} /></Field><Field label="Подпись"><Input value={block.caption ?? ''} onChange={(event) => onChange({ ...block, caption: event.target.value || null })} /></Field></div></div></div>
  if (block.type === 'SPLIT') return <div className="admin-block-fields">
    <PresentationPicker label="Пропорции блока" hint="Миниатюра показывает реальное соотношение текстовой части и фотографии." value={block.layout ?? 'BALANCED'} options={splitLayouts} onChange={(layout) => onChange({ ...block, layout })} />
    <TextSettings headingLevel={block.titleLevel ?? 'H2'} textSize={block.textSize ?? 'NORMAL'} onHeadingLevel={(titleLevel) => onChange({ ...block, titleLevel })} onTextSize={(textSize) => onChange({ ...block, textSize })} />
    <div className="grid gap-3"><Field label="Изображение"><AdminImageField required value={block.imageUrl} onChange={(imageUrl) => imageUrl && onChange({ ...block, imageUrl })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Заголовок"><Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} /></Field><Field label="Положение фото"><select value={block.imagePosition} onChange={(event) => onChange({ ...block, imagePosition: event.target.value as 'LEFT' | 'RIGHT' })}><option value="LEFT">Слева</option><option value="RIGHT">Справа</option></select></Field><Field label="Текст"><RichTextEditor ariaLabel="Текст рядом с фотографией" value={block.text} onChange={(text) => onChange({ ...block, text })} /></Field><Field label="Alt-текст"><Input value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} /></Field></div></div>
  </div>
  if (block.type === 'GALLERY') return <GalleryFields block={block} onChange={onChange} />
  if (block.type === 'QUOTE') return <div className="admin-block-fields">
    <PresentationPicker label="Цвет цитаты" hint="Миниатюры используют те же фирменные сочетания фона и текста." value={block.style ?? 'DARK'} options={quoteStyles} onChange={(style) => onChange({ ...block, style })} />
    <TextSettings textSize={block.textSize ?? 'NORMAL'} onTextSize={(textSize) => onChange({ ...block, textSize })} />
    <div className="grid gap-3"><Field label="Цитата"><RichTextEditor ariaLabel="Текст цитаты" compact value={block.text} onChange={(text) => onChange({ ...block, text })} /></Field><Field label="Автор"><Input value={block.attribution ?? ''} onChange={(event) => onChange({ ...block, attribution: event.target.value || null })} /></Field></div>
  </div>
  if (block.type === 'VIDEO') return <div className="admin-block-fields"><PresentationPicker label="Подача видео" hint="Широкая подача, спокойный отступ или затемнённый кинорежим." value={block.layout ?? 'WIDE'} options={videoLayouts} onChange={(layout) => onChange({ ...block, layout })} /><div className="grid gap-3"><Field label="Видео"><AdminVideoField required value={block.videoUrl} onChange={(videoUrl) => videoUrl && onChange({ ...block, videoUrl })} /></Field><Field label="Обложка"><AdminImageField value={block.posterUrl ?? null} onChange={(posterUrl) => onChange({ ...block, posterUrl })} /></Field><Field label="Заголовок"><Input value={block.title ?? ''} onChange={(event) => onChange({ ...block, title: event.target.value || null })} /></Field></div></div>
  return <div className="admin-block-fields">
    <PresentationPicker label="Цвет призыва" hint="Миниатюра показывает итоговый контраст блока и кнопки." value={block.style ?? 'ACCENT'} options={ctaStyles} onChange={(style) => onChange({ ...block, style })} />
    <TextSettings headingLevel={block.titleLevel ?? 'H2'} textSize={block.textSize ?? 'NORMAL'} onHeadingLevel={(titleLevel) => onChange({ ...block, titleLevel })} onTextSize={(textSize) => onChange({ ...block, textSize })} />
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Заголовок"><Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} /></Field><Field label="Текст"><RichTextEditor ariaLabel="Текст призыва" compact value={block.text ?? ''} onChange={(text) => onChange({ ...block, text: nullableDraftText(text) })} /></Field><Field label="Кнопка"><Input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} /></Field><Field label="Ссылка"><Input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} /></Field></div>
  </div>
}

function TextSettings({ headingLevel, textSize, onHeadingLevel, onTextSize }: { headingLevel?: HeadingLevel; textSize: EditorialTextSize; onHeadingLevel?: (value: HeadingLevel) => void; onTextSize: (value: EditorialTextSize) => void }) {
  return <div className="admin-text-settings">
    {headingLevel && onHeadingLevel ? <Field label="Уровень заголовка"><select value={headingLevel} onChange={(event) => onHeadingLevel(event.target.value as HeadingLevel)}>{(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'] as const).map((level) => <option key={level} value={level}>{level}</option>)}</select></Field> : null}
    <Field label="Размер основного текста"><select value={textSize} onChange={(event) => onTextSize(event.target.value as EditorialTextSize)}><option value="SMALL">Мелкий</option><option value="NORMAL">Обычный</option><option value="LARGE">Крупный</option></select></Field>
  </div>
}

type GalleryBlock = Extract<ContentBlock, { type: 'GALLERY' }>

type PresentationOption<T extends string> = { value: T; title: string; description: string; sketch: string; cells?: number[] }

const textLayouts: PresentationOption<TextBlockLayout>[] = [
  { value: 'STANDARD', title: 'Карточка', description: 'Текст на мягком фоне.', sketch: 'standard' },
  { value: 'LEAD', title: 'Вводный текст', description: 'Воздушная подача без плашки.', sketch: 'lead' },
  { value: 'COLUMNS', title: 'Две колонки', description: 'Заголовок рядом с текстом.', sketch: 'columns' },
]
const imageLayouts: PresentationOption<ImageBlockLayout>[] = [
  { value: 'WIDE', title: 'Во всю ширину', description: 'Большой панорамный кадр.', sketch: 'wide' },
  { value: 'INSET', title: 'С полями', description: 'Спокойный кадр уже контента.', sketch: 'inset' },
  { value: 'PORTRAIT', title: 'Вертикальное', description: 'Акцентный портретный формат.', sketch: 'portrait' },
]
const splitLayouts: PresentationOption<SplitBlockLayout>[] = [
  { value: 'BALANCED', title: 'Поровну', description: 'Равный вес текста и фото.', sketch: 'balanced' },
  { value: 'MEDIA_WIDE', title: 'Крупное фото', description: 'Больше места изображению.', sketch: 'media-wide' },
  { value: 'TEXT_WIDE', title: 'Больше текста', description: 'Расширенная текстовая часть.', sketch: 'text-wide' },
]
const quoteStyles: PresentationOption<QuoteBlockStyle>[] = [
  { value: 'DARK', title: 'Тёмная', description: 'Фирменный глубокий зелёный.', sketch: 'dark' },
  { value: 'LIGHT', title: 'Светлая', description: 'Мягкий нейтральный фон.', sketch: 'light' },
  { value: 'ACCENT', title: 'Акцентная', description: 'Яркий лаймовый фон.', sketch: 'accent' },
]
const videoLayouts: PresentationOption<VideoBlockLayout>[] = [
  { value: 'WIDE', title: 'Во всю ширину', description: 'Видео занимает весь ряд.', sketch: 'wide' },
  { value: 'INSET', title: 'С полями', description: 'Компактнее и спокойнее.', sketch: 'inset' },
  { value: 'CINEMA', title: 'Кинорежим', description: 'Тёмная рамка вокруг видео.', sketch: 'cinema' },
]
const ctaStyles: PresentationOption<CtaBlockStyle>[] = [
  { value: 'ACCENT', title: 'Акцентный', description: 'Лаймовый блок для главного действия.', sketch: 'accent' },
  { value: 'DARK', title: 'Тёмный', description: 'Строгий контрастный блок.', sketch: 'dark' },
  { value: 'LIGHT', title: 'Светлый', description: 'Нейтральный переход между секциями.', sketch: 'light' },
]
const galleryLayouts: PresentationOption<GalleryLayout>[] = [
  { value: 'MOSAIC', title: 'Мозаика', description: 'Чередует крупные и парные фотографии.', sketch: 'mosaic', cells: [2, 1, 1] },
  { value: 'GRID', title: 'Ровная сетка', description: 'Все фотографии одного размера.', sketch: 'grid', cells: [1, 1, 1, 1] },
  { value: 'CAROUSEL', title: 'Лента', description: 'Горизонтальная прокрутка карточек.', sketch: 'carousel', cells: [2, 2, 2] },
  { value: 'FEATURED', title: 'Главный кадр', description: 'Первое фото крупно, остальные рядом.', sketch: 'featured', cells: [3, 1, 1] },
]

function PresentationPicker<T extends string>({ label, hint, value, options, onChange }: { label: string; hint: string; value: T; options: PresentationOption<T>[]; onChange: (value: T) => void }) {
  return <div className="admin-presentation-picker">
    <div><Typography as="strong" className="admin-field-heading" variant="bodySmMedium">{label}</Typography><Typography className="admin-field-hint" variant="caption">{hint}</Typography></div>
    <div className="admin-layout-options" role="radiogroup" aria-label={label}>
      {options.map((option) => <button aria-checked={value === option.value} className="admin-layout-option" data-active={value === option.value} key={option.value} onClick={() => onChange(option.value)} role="radio" type="button">
        <span className={`admin-layout-sketch admin-layout-sketch-${option.sketch}`} aria-hidden="true">
          {(option.cells ?? [1, 1, 1]).map((cell, index) => <i key={index} style={{ flex: cell }} />)}
        </span>
        <span><Typography as="b" variant="bodySmMedium">{option.title}</Typography><Typography as="small" variant="caption">{option.description}</Typography></span>
      </button>)}
    </div>
  </div>
}

function GalleryFields({ block, onChange }: { block: GalleryBlock; onChange: (block: GalleryBlock) => void }) {
  const layout = block.layout ?? 'MOSAIC'
  const updateImage = (index: number, image: GalleryBlock['images'][number]) => onChange({ ...block, images: block.images.map((current, currentIndex) => currentIndex === index ? image : current) })
  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= block.images.length) return
    const images = [...block.images]
    ;[images[index], images[target]] = [images[target], images[index]]
    onChange({ ...block, images })
  }

  return <div className="admin-gallery-editor">
    <PresentationPicker label="Вид галереи" hint="Можно менять в любой момент: фотографии и подписи сохранятся." value={layout} options={galleryLayouts} onChange={(nextLayout) => onChange({ ...block, layout: nextLayout })} />
    <div className="admin-gallery-heading">
      <div><Typography as="strong" variant="bodySmMedium">Фотографии</Typography><Typography variant="caption">Первая фотография станет главной в варианте «Главный кадр».</Typography></div>
      <Button disabled={block.images.length >= 12} type="button" variant="outline" onClick={() => onChange({ ...block, images: [...block.images, { url: '/images/home-morning-v2.png', alt: 'Описание изображения', caption: null }] })}>Добавить фото</Button>
    </div>
    <div className="admin-gallery-images">
      {block.images.map((image, index) => <section className="admin-gallery-image" key={`${block.id}-${index}`}>
        <div className="admin-gallery-preview">{image.url ? <img alt="" src={image.url} /> : <Typography as="span" variant="caption">Нет изображения</Typography>}<Typography as="b" variant="caption">{index + 1}</Typography></div>
        <div className="admin-gallery-image-fields">
          <Field label="Изображение"><AdminImageField compact required value={image.url} onChange={(url) => url && updateImage(index, { ...image, url })} /></Field>
          <Field label="Описание для доступности"><Input placeholder="Гости за столом у окна" value={image.alt} onChange={(event) => updateImage(index, { ...image, alt: event.target.value })} /></Field>
          <Field label="Подпись (необязательно)"><Input placeholder="Вечер в ресторане" value={image.caption ?? ''} onChange={(event) => updateImage(index, { ...image, caption: nullableDraftText(event.target.value) })} /></Field>
        </div>
        <div className="admin-gallery-image-actions">
          <Button aria-label="Переместить фото выше" disabled={index === 0} size="sm" type="button" variant="ghost" onClick={() => moveImage(index, -1)}>↑</Button>
          <Button aria-label="Переместить фото ниже" disabled={index === block.images.length - 1} size="sm" type="button" variant="ghost" onClick={() => moveImage(index, 1)}>↓</Button>
          <Button disabled={block.images.length === 1} size="sm" type="button" variant="ghost" onClick={() => onChange({ ...block, images: block.images.filter((_, currentIndex) => currentIndex !== index) })}>Удалить</Button>
        </div>
      </section>)}
    </div>
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const generatedId = useId()
  const isLabelable = isValidElement<{ id?: string }>(children)
    && (children.type === 'input' || children.type === 'select' || children.type === 'textarea' || children.type === Input)

  if (isLabelable) {
    const controlId = children.props.id ?? generatedId
    const labelledControl = cloneElement(children, { id: controlId })
    return <div className="grid gap-1.5"><Typography as="label" htmlFor={controlId} variant="label">{label}</Typography><Typography asChild variant="input">{labelledControl}</Typography></div>
  }

  return <div className="grid gap-1.5"><Typography as="span" variant="label">{label}</Typography>{children}</div>
}
