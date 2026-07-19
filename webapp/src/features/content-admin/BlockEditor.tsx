import type { ContentBlock } from '@chashka-coffee/contracts'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const labels: Record<ContentBlock['type'], string> = {
  TEXT: 'Текст', IMAGE: 'Изображение', SPLIT: 'Текст + фото', GALLERY: 'Галерея',
  QUOTE: 'Цитата', VIDEO: 'Видео', CTA: 'Призыв к действию',
}

function createBlock(type: ContentBlock['type']): ContentBlock {
  const base = { id: crypto.randomUUID(), isVisible: true }
  if (type === 'TEXT') return { ...base, type, title: null, text: 'Новый текстовый блок' }
  if (type === 'IMAGE') return { ...base, type, imageUrl: '/images/home-morning-v2.png', alt: 'Описание изображения', caption: null }
  if (type === 'SPLIT') return { ...base, type, title: 'Заголовок блока', text: 'Текст блока', imageUrl: '/images/home-morning-v2.png', alt: 'Описание изображения', imagePosition: 'RIGHT' }
  if (type === 'GALLERY') return { ...base, type, images: [{ url: '/images/home-morning-v2.png', alt: 'Описание изображения', caption: null }] }
  if (type === 'QUOTE') return { ...base, type, text: 'Текст цитаты', attribution: null }
  if (type === 'VIDEO') return { ...base, type, videoUrl: '/video.mp4', posterUrl: null, title: null }
  return { ...base, type: 'CTA', title: 'Заголовок', text: null, label: 'Подробнее', url: '/' }
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
  if (block.type === 'TEXT') return <div className="grid gap-3"><Field label="Заголовок"><Input value={block.title ?? ''} onChange={(event) => onChange({ ...block, title: event.target.value || null })} /></Field><Field label="Текст"><Textarea className="min-h-32" value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></Field></div>
  if (block.type === 'IMAGE') return <div className="grid gap-3 sm:grid-cols-2"><Field label="Изображение"><Input value={block.imageUrl} onChange={(event) => onChange({ ...block, imageUrl: event.target.value })} /></Field><Field label="Alt-текст"><Input value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} /></Field><Field label="Подпись"><Input value={block.caption ?? ''} onChange={(event) => onChange({ ...block, caption: event.target.value || null })} /></Field></div>
  if (block.type === 'SPLIT') return <div className="grid gap-3 sm:grid-cols-2"><Field label="Заголовок"><Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} /></Field><Field label="Изображение"><Input value={block.imageUrl} onChange={(event) => onChange({ ...block, imageUrl: event.target.value })} /></Field><Field label="Текст"><Textarea className="min-h-28" value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></Field><div className="grid gap-3"><Field label="Alt-текст"><Input value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} /></Field><Field label="Положение фото"><select value={block.imagePosition} onChange={(event) => onChange({ ...block, imagePosition: event.target.value as 'LEFT' | 'RIGHT' })}><option value="LEFT">Слева</option><option value="RIGHT">Справа</option></select></Field></div></div>
  if (block.type === 'GALLERY') return <Field label="Изображения (URL | alt | подпись — по одному в строке)"><Textarea className="min-h-32" value={block.images.map((image) => [image.url, image.alt, image.caption ?? ''].join(' | ')).join('\n')} onChange={(event) => onChange({ ...block, images: event.target.value.split('\n').filter(Boolean).map((line) => { const [url = '', alt = '', caption = ''] = line.split('|').map((value) => value.trim()); return { url, alt: alt || 'Изображение галереи', caption: caption || null } }) })} /></Field>
  if (block.type === 'QUOTE') return <div className="grid gap-3"><Field label="Цитата"><Textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></Field><Field label="Автор"><Input value={block.attribution ?? ''} onChange={(event) => onChange({ ...block, attribution: event.target.value || null })} /></Field></div>
  if (block.type === 'VIDEO') return <div className="grid gap-3 sm:grid-cols-2"><Field label="Видео"><Input value={block.videoUrl} onChange={(event) => onChange({ ...block, videoUrl: event.target.value })} /></Field><Field label="Обложка"><Input value={block.posterUrl ?? ''} onChange={(event) => onChange({ ...block, posterUrl: event.target.value || null })} /></Field><Field label="Заголовок"><Input value={block.title ?? ''} onChange={(event) => onChange({ ...block, title: event.target.value || null })} /></Field></div>
  return <div className="grid gap-3 sm:grid-cols-2"><Field label="Заголовок"><Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} /></Field><Field label="Текст"><Input value={block.text ?? ''} onChange={(event) => onChange({ ...block, text: event.target.value || null })} /></Field><Field label="Кнопка"><Input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} /></Field><Field label="Ссылка"><Input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} /></Field></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label> }
