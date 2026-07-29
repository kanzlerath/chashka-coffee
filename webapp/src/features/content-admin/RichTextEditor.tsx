import { sanitizeRichText } from '@chashka-coffee/contracts'
import { useEffect, useRef, useState, type MouseEvent } from 'react'

import { Typography } from '@/components/ui/typography'
import { shouldRunToolbarCommand } from './rich-text-editor-events'

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  compact?: boolean
}

type TableSelection = {
  cell: HTMLTableCellElement
  row: HTMLTableRowElement
  table: HTMLTableElement
}

function tableSelection(editor: HTMLElement, range: Range | null): TableSelection | null {
  if (!range) return null
  const start = range.startContainer
  const element = start.nodeType === Node.ELEMENT_NODE ? start as Element : start.parentElement
  const cell = element?.closest('th, td')
  const row = cell?.closest('tr')
  const table = row?.closest('table')
  if (!cell || !row || !table || !editor.contains(table)) return null
  return {
    cell: cell as HTMLTableCellElement,
    row: row as HTMLTableRowElement,
    table: table as HTMLTableElement,
  }
}

export function RichTextEditor({ value, onChange, ariaLabel, compact = false }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const [tableSize, setTableSize] = useState<{ rows: number; columns: number } | null>(null)

  useEffect(() => {
    const editor = editorRef.current
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) editor.innerHTML = value
  }, [value])

  const rememberSelection = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount) {
      setTableSize(null)
      return
    }
    const range = selection.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) {
      setTableSize(null)
      return
    }
    selectionRef.current = range.cloneRange()
    const context = tableSelection(editor, range)
    setTableSize(context ? {
      rows: context.table.rows.length,
      columns: Math.max(...Array.from(context.table.rows, (row) => row.cells.length)),
    } : null)
  }

  const restoreSelection = () => {
    const selection = window.getSelection()
    if (!selection || !selectionRef.current) return
    selection.removeAllRanges()
    selection.addRange(selectionRef.current)
  }

  const sync = () => {
    const editor = editorRef.current
    if (!editor) return
    onChange(editor.innerHTML)
    rememberSelection()
  }

  const run = (command: string, commandValue?: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    restoreSelection()
    document.execCommand(command, false, commandValue)
    sync()
  }

  const addLink = () => {
    const href = window.prompt('Введите ссылку: /menu или https://example.com')
    if (!href) return
    if (!href.startsWith('/') && !/^https?:\/\//i.test(href)) {
      window.alert('Ссылка должна начинаться с /, http:// или https://')
      return
    }
    run('createLink', href)
  }

  const insertTable = () => {
    run('insertHTML', '<table><thead><tr><th>Заголовок 1</th><th>Заголовок 2</th><th>Заголовок 3</th></tr></thead><tbody><tr><td>Ячейка</td><td>Ячейка</td><td>Ячейка</td></tr><tr><td>Ячейка</td><td>Ячейка</td><td>Ячейка</td></tr></tbody></table><p><br></p>')
    const tables = editorRef.current?.querySelectorAll('table')
    const firstCell = tables?.[tables.length - 1]?.querySelector<HTMLElement>('th, td')
    if (firstCell) focusElement(firstCell, true)
  }

  const focusElement = (element: HTMLElement, selectContents = false) => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection) return
    const range = document.createRange()
    range.selectNodeContents(element)
    if (!selectContents) range.collapse(false)
    editor.focus()
    selection.removeAllRanges()
    selection.addRange(range)
    selectionRef.current = range.cloneRange()
    rememberSelection()
  }

  const commitTableChange = (focusTarget: HTMLElement, selectContents = false) => {
    const editor = editorRef.current
    if (!editor) return
    focusElement(focusTarget, selectContents)
    onChange(editor.innerHTML)
  }

  const editTable = (action: 'add-row' | 'delete-row' | 'add-column' | 'delete-column' | 'delete-table') => {
    const editor = editorRef.current
    if (!editor) return
    restoreSelection()
    const context = tableSelection(editor, selectionRef.current)
    if (!context) return
    const { cell, row, table } = context
    const columnIndex = cell.cellIndex

    if (action === 'add-row') {
      const columnCount = Math.max(...Array.from(table.rows, (currentRow) => currentRow.cells.length))
      const body = table.tBodies[0] ?? table.createTBody()
      const insertionIndex = row.parentElement === body ? row.sectionRowIndex + 1 : 0
      const nextRow = body.insertRow(insertionIndex)
      for (let index = 0; index < columnCount; index += 1) nextRow.insertCell().textContent = 'Ячейка'
      commitTableChange(nextRow.cells[Math.min(columnIndex, nextRow.cells.length - 1)], true)
      return
    }

    if (action === 'delete-row') {
      if (table.rows.length <= 1) return
      const rowIndex = row.rowIndex
      row.remove()
      const nextRow = table.rows[Math.min(rowIndex, table.rows.length - 1)]
      commitTableChange(nextRow.cells[Math.min(columnIndex, nextRow.cells.length - 1)])
      return
    }

    if (action === 'add-column') {
      Array.from(table.rows).forEach((currentRow) => {
        const nextCell = document.createElement(currentRow.parentElement?.tagName === 'THEAD' ? 'th' : 'td')
        nextCell.textContent = nextCell.tagName === 'TH' ? 'Заголовок' : 'Ячейка'
        currentRow.insertBefore(nextCell, currentRow.cells[columnIndex + 1] ?? null)
      })
      commitTableChange(row.cells[columnIndex + 1], true)
      return
    }

    if (action === 'delete-column') {
      const columnCount = Math.max(...Array.from(table.rows, (currentRow) => currentRow.cells.length))
      if (columnCount <= 1) return
      Array.from(table.rows).forEach((currentRow) => {
        if (currentRow.cells.length > 1) currentRow.cells[columnIndex]?.remove()
      })
      commitTableChange(row.cells[Math.min(columnIndex, row.cells.length - 1)])
      return
    }

    const paragraph = document.createElement('p')
    paragraph.append(document.createElement('br'))
    table.replaceWith(paragraph)
    commitTableChange(paragraph)
  }

  const runFromClick = (event: MouseEvent<HTMLButtonElement>, command: string, commandValue?: string) => {
    if (shouldRunToolbarCommand(event.detail)) run(command, commandValue)
  }

  const finishEditing = () => {
    const editor = editorRef.current
    if (!editor) return
    const sanitized = sanitizeRichText(editor.innerHTML)
    if (editor.innerHTML !== sanitized) editor.innerHTML = sanitized
    onChange(sanitized)
  }

  return <div className="admin-rich-editor" data-compact={compact}>
    <div aria-label="Форматирование текста" className="admin-rich-toolbar" role="toolbar" onDoubleClick={(event) => event.preventDefault()} onMouseDown={(event) => {
      if ((event.target as HTMLElement).closest('button')) event.preventDefault()
    }}>
      <button aria-label="Жирный" title="Жирный" type="button" onClick={(event) => runFromClick(event, 'bold')}><Typography as="span" variant="emphasis">Ж</Typography></button>
      <button aria-label="Курсив" title="Курсив" type="button" onClick={(event) => runFromClick(event, 'italic')}><Typography as="span" className="admin-rich-icon-italic" variant="controlXs">К</Typography></button>
      <button aria-label="Подчёркнутый" title="Подчёркнутый" type="button" onClick={(event) => runFromClick(event, 'underline')}><Typography as="span" className="admin-rich-icon-underline" variant="controlXs">Ч</Typography></button>
      <span aria-hidden="true" />
      <select aria-label="Уровень абзаца" defaultValue="p" title="Абзац или заголовок" onChange={(event) => run('formatBlock', event.target.value)}>
        <option value="p">Абзац</option>
        <option value="h1">H1</option>
        <option value="h2">H2</option>
        <option value="h3">H3</option>
        <option value="h4">H4</option>
        <option value="h5">H5</option>
        <option value="h6">H6</option>
      </select>
      <button aria-label="Маркированный список" title="Маркированный список" type="button" onClick={(event) => runFromClick(event, 'insertUnorderedList')}><Typography as="span" variant="controlXs">• Список</Typography></button>
      <button aria-label="Нумерованный список" title="Нумерованный список" type="button" onClick={(event) => runFromClick(event, 'insertOrderedList')}><Typography as="span" variant="controlXs">1. Список</Typography></button>
      <button aria-label="Добавить ссылку" title="Добавить ссылку" type="button" onClick={(event) => { if (shouldRunToolbarCommand(event.detail)) addLink() }}><Typography as="span" variant="controlXs">Ссылка</Typography></button>
      <button aria-label="Удалить ссылку" title="Удалить ссылку" type="button" onClick={(event) => runFromClick(event, 'unlink')}><Typography as="span" variant="controlXs">Без ссылки</Typography></button>
      {!compact ? <button aria-label="Вставить таблицу" title="Таблица 3 × 3" type="button" onClick={(event) => { if (shouldRunToolbarCommand(event.detail)) insertTable() }}><Typography as="span" variant="controlXs">Таблица</Typography></button> : null}
      <button aria-label="Очистить форматирование" title="Очистить форматирование" type="button" onClick={(event) => runFromClick(event, 'removeFormat')}><Typography as="span" variant="controlXs">Очистить</Typography></button>
    </div>
    {!compact ? <div aria-label="Управление таблицей" className="admin-table-toolbar" role="toolbar" onMouseDown={(event) => {
      if ((event.target as HTMLElement).closest('button')) event.preventDefault()
    }}>
      <Typography aria-live="polite" as="span" variant="caption">{tableSize ? `Таблица ${tableSize.rows} × ${tableSize.columns}` : 'Таблица: выберите ячейку'}</Typography>
      <button aria-label="Добавить строку ниже" disabled={!tableSize} title="Добавить строку ниже" type="button" onClick={(event) => { if (shouldRunToolbarCommand(event.detail)) editTable('add-row') }}><Typography as="span" variant="controlXs">+ строка</Typography></button>
      <button aria-label="Удалить строку" disabled={!tableSize || tableSize.rows <= 1} title="Удалить строку" type="button" onClick={(event) => { if (shouldRunToolbarCommand(event.detail)) editTable('delete-row') }}><Typography as="span" variant="controlXs">− строка</Typography></button>
      <button aria-label="Добавить столбец справа" disabled={!tableSize} title="Добавить столбец справа" type="button" onClick={(event) => { if (shouldRunToolbarCommand(event.detail)) editTable('add-column') }}><Typography as="span" variant="controlXs">+ столбец</Typography></button>
      <button aria-label="Удалить столбец" disabled={!tableSize || tableSize.columns <= 1} title="Удалить столбец" type="button" onClick={(event) => { if (shouldRunToolbarCommand(event.detail)) editTable('delete-column') }}><Typography as="span" variant="controlXs">− столбец</Typography></button>
      <button aria-label="Удалить таблицу" disabled={!tableSize} title="Удалить таблицу" type="button" onClick={(event) => { if (shouldRunToolbarCommand(event.detail)) editTable('delete-table') }}><Typography as="span" variant="controlXs">Удалить таблицу</Typography></button>
    </div> : null}
    <div
      aria-label={ariaLabel}
      className="admin-rich-content"
      contentEditable
      data-placeholder="Начните вводить текст…"
      ref={editorRef}
      role="textbox"
      suppressContentEditableWarning
      onBlur={finishEditing}
      onInput={sync}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      onPaste={(event) => {
        event.preventDefault()
        run('insertText', event.clipboardData.getData('text/plain'))
      }}
    />
  </div>
}
