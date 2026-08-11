import { upsertMenuRequestSchema, type UpsertMenuRequest } from '@chashka-coffee/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AdminField, AdminFormIntro, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import { supportedImageTypes, uploadMediaFile } from '@/features/media-admin'
import { toPublicSlug } from '@/lib/slugify'

import { CatalogAdminApi } from './api'
import { buildImportRows, importFieldLabels, matchImages, parseWorkbook, suggestColumnMapping, type ColumnMapping, type ImportField, type ParsedWorkbook } from './menu-import'

type ImportProgress = { phase: 'photos' | 'menu'; done: number; total: number }
const primaryFields: ImportField[] = ['category', 'name', 'price', 'image']
const optionalFields = (Object.keys(importFieldLabels) as ImportField[]).filter((field) => !primaryFields.includes(field))
const defaultImageMaxBytes = 10 * 1024 * 1024
const formatMegabytes = (value: number) => `${(value / 1024 / 1024).toFixed(1)} МБ`

export function MenuImportPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const spreadsheetInput = useRef<HTMLInputElement>(null)
  const imageFolderInput = useRef<HTMLInputElement>(null)
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [menuDraft, setMenuDraft] = useState<UpsertMenuRequest>({ slug: '', name: '', description: null })
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [completedMenuId, setCompletedMenuId] = useState<string | null>(null)

  useEffect(() => {
    imageFolderInput.current?.setAttribute('webkitdirectory', '')
    imageFolderInput.current?.setAttribute('directory', '')
  }, [])

  const rows = useMemo(() => workbook ? buildImportRows(workbook.rows, mapping) : [], [workbook, mapping])
  const imageMatches = useMemo(() => matchImages(rows, imageFiles), [rows, imageFiles])
  const rowErrors = useMemo(() => rows.flatMap((row) => {
    const match = imageMatches.get(row.rowNumber)
    const unsupportedImage = match?.file && !supportedImageTypes.has(match.file.type)
      ? `Файл «${match.file.name}» имеет неподдерживаемый формат.`
      : null
    const oversizedImage = match?.file && match.file.size > defaultImageMaxBytes
      ? `Файл «${match.file.name}» весит ${formatMegabytes(match.file.size)} — уменьшите его до 10 МБ.`
      : null
    return [...row.errors, match?.error, unsupportedImage, oversizedImage].filter((value): value is string => Boolean(value)).map((error) => ({ rowNumber: row.rowNumber, error }))
  }), [imageMatches, rows])
  const imageReferences = rows.filter((row) => row.imageReference)
  const matchedImages = imageReferences.filter((row) => imageMatches.get(row.rowNumber)?.file).length
  const missingMappings = ['category', 'name', 'price'].filter((field) => !mapping[field as ImportField])
  const normalizedMenuDraft = { ...menuDraft, slug: menuDraft.slug || toPublicSlug(menuDraft.name) }
  const menuDraftIsValid = upsertMenuRequestSchema.safeParse(normalizedMenuDraft).success
  const canImport = Boolean(workbook && menuDraftIsValid && !missingMappings.length && !rowErrors.length && rows.length && !progress && !completedMenuId)

  const selectSpreadsheet = async (file?: File) => {
    if (!file) return
    setSourceError(null)
    setRunError(null)
    setCompletedMenuId(null)
    try {
      const parsed = await parseWorkbook(file)
      setWorkbook(parsed)
      setMapping(suggestColumnMapping(parsed.headers))
    } catch (error) {
      setWorkbook(null)
      setMapping({})
      setSourceError(error instanceof Error ? error.message : 'Не удалось прочитать Excel-файл.')
    }
  }

  const selectImages = (files: File[]) => {
    setImageFiles(files)
    setRunError(null)
    setCompletedMenuId(null)
  }

  const importMenu = async () => {
    if (!canImport) return
    const catalog = new CatalogAdminApi(api)
    setRunError(null)
    try {
      const uniqueFiles = [...new Set(imageReferences.map((row) => imageMatches.get(row.rowNumber)?.file).filter((file): file is File => Boolean(file)))]
      const uploadedUrls = new Map<File, string>()
      setProgress({ phase: 'photos', done: 0, total: uniqueFiles.length })
      for (let index = 0; index < uniqueFiles.length; index += 1) {
        const result = await uploadMediaFile(api, uniqueFiles[index])
        uploadedUrls.set(uniqueFiles[index], result.asset.publicUrl)
        setProgress({ phase: 'photos', done: index + 1, total: uniqueFiles.length })
      }

      const categoryRows = [...new Map(rows.map((row) => [row.categorySlug, row])).values()]
      setProgress({ phase: 'menu', done: 0, total: 1 })
      const created = await catalog.importMenu({
        menu: normalizedMenuDraft,
        categories: categoryRows.map((category, index) => ({
          slug: category.categorySlug,
          name: category.categoryName,
          position: (index + 1) * 10,
          items: rows.filter((row) => row.categorySlug === category.categorySlug).map((row) => {
            const image = imageMatches.get(row.rowNumber)?.file ?? null
            return { ...row.item, imageUrl: image ? uploadedUrls.get(image) ?? null : null }
          }),
        })),
      })
      setProgress({ phase: 'menu', done: 1, total: 1 })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'menus'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'media'] })
      setCompletedMenuId(created.menu.id)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Импорт остановлен из-за ошибки. Уже загруженные изображения останутся в медиатеке и не будут загружаться повторно.')
    } finally {
      setProgress(null)
    }
  }

  return <section className="admin-page admin-page-editor admin-menu-import-page">
    <AdminPageHeader eyebrow="Меню" title="Импорт из Excel" description="Сначала проверим таблицу и локальные фотографии. Новый набор меню создастся только после подтверждения." actions={<Button asChild variant="outline"><Link to="/menus">К списку меню</Link></Button>} />

    <Card className="admin-editor-surface">
      <CardHeader><CardTitle>1. Источники</CardTitle><CardDescription>Выберите Excel и папку из Obsidian с изображениями. Файлы остаются на вашем компьютере до запуска импорта.</CardDescription></CardHeader>
      <CardContent className="admin-form-stack">
        <div className="admin-form-grid-2">
          <AdminField label="Excel-файл" hint={workbook ? `Лист «${workbook.sheetName}» · ${workbook.rows.length} строк` : 'Поддерживаются XLSX, XLS и CSV.'}>
            <Input ref={spreadsheetInput} accept=".xlsx,.xls,.csv" type="file" disabled={Boolean(progress)} onChange={(event) => void selectSpreadsheet(event.target.files?.[0])} />
          </AdminField>
          <AdminField label="Папка с фотографиями" hint={imageFiles.length ? `Найдено файлов: ${imageFiles.length}` : 'Выберите папку images из Obsidian — ZIP не нужен.'}>
            <Input ref={imageFolderInput} accept="image/jpeg,image/png,image/webp,image/avif" multiple type="file" disabled={Boolean(progress)} onChange={(event) => selectImages([...event.target.files ?? []])} />
          </AdminField>
        </div>
        <AdminFormIntro>Ссылка вида <code>![](images/page004_img002.jpg)</code> сопоставляется по пути, а внешняя ссылка — по имени файла, например <code>1_upd.webp</code>.</AdminFormIntro>
        {sourceError ? <p className="admin-state-message admin-state-error">{sourceError}</p> : null}
      </CardContent>
    </Card>

    {workbook ? <Card className="admin-editor-surface">
      <CardHeader><CardTitle>2. Колонки таблицы</CardTitle><CardDescription>Импортёр уже предложил соответствия. Проверьте обязательные поля; остальные можно оставить пустыми.</CardDescription></CardHeader>
      <CardContent className="admin-form-stack">
        <div className="admin-form-grid-2">{primaryFields.map((field) => <ColumnSelector key={field} field={field} headers={workbook.headers} mapping={mapping} onChange={setMapping} required={field !== 'image'} />)}</div>
        <details className="admin-advanced-fields"><summary>Дополнительные поля</summary><div className="admin-form-grid-2 pt-4">{optionalFields.map((field) => <ColumnSelector key={field} field={field} headers={workbook.headers} mapping={mapping} onChange={setMapping} />)}</div></details>
        {missingMappings.length ? <p className="admin-state-message admin-state-error">Укажите колонки: {missingMappings.map((field) => importFieldLabels[field as ImportField].toLocaleLowerCase('ru')).join(', ')}.</p> : null}
      </CardContent>
    </Card> : null}

    {workbook && !missingMappings.length ? <Card className="admin-editor-surface">
      <CardHeader><CardTitle>3. Предпросмотр</CardTitle><CardDescription>Пока вы не нажали «Импортировать», никакие блюда, категории или изображения не создаются.</CardDescription></CardHeader>
      <CardContent className="admin-form-stack">
        <div className="admin-menu-import-summary"><span><strong>{rows.length}</strong> позиций</span><span><strong>{new Set(rows.map((row) => row.categorySlug)).size}</strong> категорий</span><span><strong>{matchedImages} из {imageReferences.length}</strong> фото найдено</span><span className={rowErrors.length ? 'is-error' : undefined}><strong>{rowErrors.length}</strong> ошибок</span></div>
        {rowErrors.length ? <div className="admin-menu-import-errors"><strong>Исправьте перед импортом</strong><ul>{rowErrors.slice(0, 12).map(({ rowNumber, error }, index) => <li key={`${rowNumber}:${index}`}>Строка {rowNumber}: {error}</li>)}</ul>{rowErrors.length > 12 ? <p>И ещё {rowErrors.length - 12}.</p> : null}</div> : <div className="admin-help-note"><strong>Проверка пройдена</strong><p>Будет создан новый набор с категориями и блюдами. Фотографии сначала загрузятся в медиатеку по одной, поэтому общий размер папки не ограничивает импорт.</p></div>}
        <div className="admin-menu-import-sample">{rows.slice(0, 6).map((row) => <div key={row.rowNumber}><span>{row.categoryName}</span><strong>{row.item.name || 'Без названия'}</strong><small>{row.item.priceKopecks / 100 || 0} ₽{row.imageReference ? ` · ${imageMatches.get(row.rowNumber)?.file ? 'фото найдено' : 'фото не найдено'}` : ''}</small></div>)}</div>
      </CardContent>
    </Card> : null}

    {workbook ? <Card className="admin-editor-surface">
      <CardHeader><CardTitle>4. Новый набор меню</CardTitle><CardDescription>Импорт всегда создаёт отдельный набор: существующее меню останется без изменений.</CardDescription></CardHeader>
      <CardContent className="admin-form-stack">
        <div className="admin-form-grid-2"><AdminField label="Название набора" required><Input required disabled={Boolean(progress) || Boolean(completedMenuId)} placeholder="Основное меню" value={menuDraft.name} onChange={(event) => setMenuDraft((value) => ({ ...value, name: event.target.value }))} /></AdminField><AdminField label="Описание"><Textarea disabled={Boolean(progress) || Boolean(completedMenuId)} placeholder="Например, меню городских ресторанов" value={menuDraft.description ?? ''} onChange={(event) => setMenuDraft((value) => ({ ...value, description: event.target.value.trim() || null }))} /></AdminField></div>
        <details className="admin-advanced-fields"><summary>Адрес страницы</summary><div className="pt-4"><AdminField label="Адрес" hint="Если оставить пустым, сформируется из названия."><Input disabled={Boolean(progress) || Boolean(completedMenuId)} placeholder="main-menu" value={menuDraft.slug} onChange={(event) => setMenuDraft((value) => ({ ...value, slug: event.target.value }))} /></AdminField></div></details>
        {progress ? <div className="admin-menu-import-progress"><div><strong>{progress.phase === 'photos' ? 'Загружаем фотографии' : 'Создаём меню'}</strong><span>{progress.done} из {progress.total}</span></div><Progress value={progress.total ? progress.done / progress.total * 100 : 100} /></div> : null}
        {runError ? <p className="admin-state-message admin-state-error">{runError}</p> : null}
        {completedMenuId ? <div className="admin-help-note"><strong>Импорт завершён</strong><p>Набор создан. Проверьте несколько карточек, затем назначьте его нужным ресторанам.</p><Button asChild className="mt-3"><Link params={{ menuId: completedMenuId }} to="/menus/$menuId">Открыть импортированное меню</Link></Button></div> : <div className="admin-form-actions"><Button disabled={!canImport} size="lg" type="button" onClick={() => void importMenu()}>Импортировать {rows.length ? `${rows.length} позиций` : 'меню'}</Button></div>}
      </CardContent>
    </Card> : null}
  </section>
}

function ColumnSelector({ field, headers, mapping, onChange, required = false }: { field: ImportField; headers: string[]; mapping: ColumnMapping; onChange: (mapping: ColumnMapping) => void; required?: boolean }) {
  return <AdminField label={importFieldLabels[field]} required={required}><select value={mapping[field] ?? ''} onChange={(event) => onChange({ ...mapping, [field]: event.target.value || undefined })}><option value="">Не импортировать</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></AdminField>
}
