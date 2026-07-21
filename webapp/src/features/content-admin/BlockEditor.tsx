import type {
  ContentBlock,
  CtaBlockStyle,
  GalleryLayout,
  ImageBlockLayout,
  QuoteBlockStyle,
  SplitBlockLayout,
  TextBlockLayout,
  VideoBlockLayout,
} from '@chashka-coffee/contracts'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { nullableDraftText } from '@/lib/form-drafts'

const labels: Record<ContentBlock['type'], string> = {
  TEXT: 'Текст', IMAGE: 'Изображение', SPLIT: 'Текст + фото', GALLERY: 'Галерея',
  QUOTE: 'Цитата', VIDEO: 'Видео', CTA: 'Призыв к действию',
}

function createBlock(type: ContentBlock['type']): ContentBlock {
  const base = { id: crypto.randomUUID(), isVisible: true }
  if (type === 'TEXT') return { ...base, type, layout: 'STANDARD', title: null, text: 'Новый текстовый блок' }
  if (type === 'IMAGE') return { ...base, type, layout: 'WIDE', imageUrl: '/images/home-morning-v2.png', alt: 'Описание изображения', caption: null }
  if (type === 'SPLIT') return { ...base, type, layout: 'BALANCED', title: 'Заголовок блока', text: 'Текст блока', imageUrl: '/images/home-morning-v2.png', alt: 'Описание изображения', imagePosition: 'RIGHT' }
  if (type === 'GALLERY') return { ...base, type, layout: 'MOSAIC', images: [{ url: '/images/home-morning-v2.png', alt: 'Описание изображения', caption: null }] }
  if (type === 'QUOTE') return { ...base, type, style: 'DARK', text: 'Текст цитаты', attribution: null }
  if (type === 'VIDEO') return { ...base, type, layout: 'WIDE', videoUrl: '/video.mp4', posterUrl: null, title: null }
  return { ...base, type: 'CTA', style: 'ACCENT', title: 'Заголовок', text: null, label: 'Подробнее', url: '/' }
}

export function BlockEditor({ blocks, onChange }: { blocks: ContentBlock[]; onChange: (blocks: ContentBlock[]) => void }) {
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
        <strong>Содержимое страницы</strong>
        <p>Добавляйте блоки, меняйте порядок и временно скрывайте их без удаления.</p>
      </div>
      <select aria-label="Добавить блок" defaultValue="" onChange={(event) => {
        if (!event.target.value) return
        onChange([...blocks, createBlock(event.target.value as ContentBlock['type'])])
        event.target.value = ''
      }}>
        <option value="" disabled>+ Добавить блок</option>
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    {blocks.length === 0 ? <div className="admin-block-empty">Здесь появится структура материала. Начните с текстового блока или связки текста с фотографией.</div> : null}
    <div className="admin-block-list">
      {blocks.map((block, index) => <article className="admin-block-card" key={block.id}>
        <header>
          <div><span>{String(index + 1).padStart(2, '0')}</span><strong>{labels[block.type]}</strong></div>
          <div className="admin-block-actions">
            <label><input checked={block.isVisible} type="checkbox" onChange={(event) => update(index, { ...block, isVisible: event.target.checked })} /> Показывать</label>
            <Button disabled={index === 0} size="sm" type="button" variant="ghost" onClick={() => move(index, -1)}>↑</Button>
            <Button disabled={index === blocks.length - 1} size="sm" type="button" variant="ghost" onClick={() => move(index, 1)}>↓</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => onChange(blocks.filter((_, currentIndex) => currentIndex !== index))}>Удалить</Button>
          </div>
        </header>
        <BlockFields block={block} onChange={(next) => update(index, next)} />
      </article>)}
    </div>
  </section>
}

function BlockFields({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  if (block.type === 'TEXT') return <div className="admin-block-fields"><PresentationPicker label="Композиция текста" hint="Контент не изменится — меняется только ритм и расположение." value={block.layout ?? 'STANDARD'} options={textLayouts} onChange={(layout) => onChange({ ...block, layout })} /><div className="grid gap-3"><Field label="Заголовок"><Input value={block.title ?? ''} onChange={(event) => onChange({ ...block, title: event.target.value || null })} /></Field><Field label="Текст"><Textarea className="min-h-32" value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></Field></div></div>
  if (block.type === 'IMAGE') return <div className="admin-block-fields"><PresentationPicker label="Размер изображения" hint="Выберите, насколько сильно фотография должна доминировать на странице." value={block.layout ?? 'WIDE'} options={imageLayouts} onChange={(layout) => onChange({ ...block, layout })} /><div className="grid gap-3 sm:grid-cols-2"><Field label="Изображение"><Input value={block.imageUrl} onChange={(event) => onChange({ ...block, imageUrl: event.target.value })} /></Field><Field label="Alt-текст"><Input value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} /></Field><Field label="Подпись"><Input value={block.caption ?? ''} onChange={(event) => onChange({ ...block, caption: event.target.value || null })} /></Field></div></div>
  if (block.type === 'SPLIT') return <div className="admin-block-fields"><PresentationPicker label="Пропорции блока" hint="Сторону фотографии по-прежнему можно выбрать отдельно." value={block.layout ?? 'BALANCED'} options={splitLayouts} onChange={(layout) => onChange({ ...block, layout })} /><div className="grid gap-3 sm:grid-cols-2"><Field label="Заголовок"><Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} /></Field><Field label="Изображение"><Input value={block.imageUrl} onChange={(event) => onChange({ ...block, imageUrl: event.target.value })} /></Field><Field label="Текст"><Textarea className="min-h-28" value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></Field><div className="grid gap-3"><Field label="Alt-текст"><Input value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} /></Field><Field label="Положение фото"><select value={block.imagePosition} onChange={(event) => onChange({ ...block, imagePosition: event.target.value as 'LEFT' | 'RIGHT' })}><option value="LEFT">Слева</option><option value="RIGHT">Справа</option></select></Field></div></div></div>
  if (block.type === 'GALLERY') return <GalleryFields block={block} onChange={onChange} />
  if (block.type === 'QUOTE') return <div className="admin-block-fields"><PresentationPicker label="Цвет цитаты" hint="Три контрастных оформления внутри палитры «Чашки кофе»." value={block.style ?? 'DARK'} options={quoteStyles} onChange={(style) => onChange({ ...block, style })} /><div className="grid gap-3"><Field label="Цитата"><Textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></Field><Field label="Автор"><Input value={block.attribution ?? ''} onChange={(event) => onChange({ ...block, attribution: event.target.value || null })} /></Field></div></div>
  if (block.type === 'VIDEO') return <div className="admin-block-fields"><PresentationPicker label="Подача видео" hint="Широкая подача, спокойный отступ или затемнённый кинорежим." value={block.layout ?? 'WIDE'} options={videoLayouts} onChange={(layout) => onChange({ ...block, layout })} /><div className="grid gap-3 sm:grid-cols-2"><Field label="Видео"><Input value={block.videoUrl} onChange={(event) => onChange({ ...block, videoUrl: event.target.value })} /></Field><Field label="Обложка"><Input value={block.posterUrl ?? ''} onChange={(event) => onChange({ ...block, posterUrl: event.target.value || null })} /></Field><Field label="Заголовок"><Input value={block.title ?? ''} onChange={(event) => onChange({ ...block, title: event.target.value || null })} /></Field></div></div>
  return <div className="admin-block-fields"><PresentationPicker label="Цвет призыва" hint="Выберите контраст, подходящий к соседним блокам." value={block.style ?? 'ACCENT'} options={ctaStyles} onChange={(style) => onChange({ ...block, style })} /><div className="grid gap-3 sm:grid-cols-2"><Field label="Заголовок"><Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} /></Field><Field label="Текст"><Input value={block.text ?? ''} onChange={(event) => onChange({ ...block, text: event.target.value || null })} /></Field><Field label="Кнопка"><Input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} /></Field><Field label="Ссылка"><Input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} /></Field></div></div>
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
    <div><strong className="admin-field-heading">{label}</strong><p className="admin-field-hint">{hint}</p></div>
    <div className="admin-layout-options" role="radiogroup" aria-label={label}>
      {options.map((option) => <button aria-checked={value === option.value} className="admin-layout-option" data-active={value === option.value} key={option.value} onClick={() => onChange(option.value)} role="radio" type="button">
        <span className={`admin-layout-sketch admin-layout-sketch-${option.sketch}`} aria-hidden="true">
          {(option.cells ?? [1, 1, 1]).map((cell, index) => <i key={index} style={{ flex: cell }} />)}
        </span>
        <span><b>{option.title}</b><small>{option.description}</small></span>
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
      <div><strong>Фотографии</strong><p>Первая фотография станет главной в варианте «Главный кадр».</p></div>
      <Button disabled={block.images.length >= 12} type="button" variant="outline" onClick={() => onChange({ ...block, images: [...block.images, { url: '/images/home-morning-v2.png', alt: 'Описание изображения', caption: null }] })}>Добавить фото</Button>
    </div>
    <div className="admin-gallery-images">
      {block.images.map((image, index) => <section className="admin-gallery-image" key={`${block.id}-${index}`}>
        <div className="admin-gallery-preview">{image.url ? <img alt="" src={image.url} /> : <span>Нет изображения</span>}<b>{index + 1}</b></div>
        <div className="admin-gallery-image-fields">
          <Field label="Ссылка на изображение"><Input placeholder="https://…" value={image.url} onChange={(event) => updateImage(index, { ...image, url: event.target.value })} /></Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label> }
