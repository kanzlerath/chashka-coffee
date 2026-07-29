import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { BlockEditor } from '../src/features/content-admin/BlockEditor'
import { ContentPreview } from '../src/features/content-admin/ContentPreview'
import { shouldRunToolbarCommand } from '../src/features/content-admin/rich-text-editor-events'

const visibleTextBlock = {
  id: '018f8d94-1f4f-7000-8000-000000000020',
  type: 'TEXT',
  isVisible: true,
  layout: 'STANDARD',
  title: 'Программа вечера',
  titleLevel: 'H3',
  textSize: 'LARGE',
  text: '<p><strong>Начало в 19:00</strong></p>',
} as const

describe('content block editor', () => {
  test('places block creation after existing blocks and exposes rich-text controls', () => {
    const markup = renderToStaticMarkup(<BlockEditor blocks={[
      visibleTextBlock,
      { ...visibleTextBlock, id: '018f8d94-1f4f-7000-8000-000000000021', title: 'Второй блок' },
    ]} onChange={() => undefined} />)

    expect(markup.indexOf('admin-add-block')).toBeGreaterThan(markup.indexOf('admin-block-card'))
    expect(markup).toContain('aria-label="Жирный"')
    expect(markup).toContain('aria-label="Маркированный список"')
    expect(markup).toContain('aria-label="Вставить таблицу"')
    expect(markup).toContain('aria-label="Добавить строку ниже"')
    expect(markup).toContain('aria-label="Удалить строку"')
    expect(markup).toContain('aria-label="Добавить столбец справа"')
    expect(markup).toContain('aria-label="Удалить столбец"')
    expect(markup).toContain('aria-label="Удалить таблицу"')
    expect(markup).toContain('Дублировать')
    expect(markup).toContain('Свернуть')
    expect(markup).toContain('Итоговый предпросмотр')
    expect(markup).toContain('<option value="H1">H1</option>')
    expect(markup.match(/admin-block-body/g)).toHaveLength(1)
    expect(markup).toContain('data-collapsed="true"')
    expect(markup).toContain('aria-label="Открыть блок 02: Текст"')
    const richEditorIndex = markup.indexOf('admin-rich-editor')
    expect(markup.lastIndexOf('</label>', richEditorIndex)).toBeGreaterThan(markup.lastIndexOf('<label', richEditorIndex))
  })

  test('runs a toolbar toggle only once in a double-click sequence', () => {
    expect(shouldRunToolbarCommand(1)).toBe(true)
    expect(shouldRunToolbarCommand(2)).toBe(false)
  })

  test('renders only visible blocks with heading level, text size and safe rich text', () => {
    const markup = renderToStaticMarkup(<ContentPreview
      blocks={[
        visibleTextBlock,
        { ...visibleTextBlock, id: '018f8d94-1f4f-7000-8000-000000000021', isVisible: false, title: 'Скрытый блок', text: '<script>alert(1)</script>' },
      ]}
      excerpt="Короткое описание"
      title="Кофейный вечер"
    />)

    expect(markup).toContain('>Программа вечера</h3>')
    expect(markup).toContain('admin-preview-copy-large')
    expect(markup).toContain('<strong>Начало в 19:00</strong>')
    expect(markup).not.toContain('Скрытый блок')
    expect(markup).not.toContain('<script>')
  })
})
