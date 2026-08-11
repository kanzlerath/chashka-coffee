import { importCakeProductsRequestSchema, productListResponseSchema } from '@chashka-coffee/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AdminField, AdminFormIntro, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/features/auth'
import { supportedImageTypes, uploadMediaFile } from '@/features/media-admin'

import { buildCakeImportProducts, cakeImportFieldLabels, matchCakeImages, parseCakeWorkbook, suggestCakeColumnMapping, type CakeColumnMapping, type CakeImportField, type CakeWorkbook } from './cake-import'

const primaryFields: CakeImportField[] = ['category', 'name', 'variant', 'weight', 'price', 'image']
const optionalFields = (Object.keys(cakeImportFieldLabels) as CakeImportField[]).filter((field) => !primaryFields.includes(field))
const maxImageBytes = 10 * 1024 * 1024

export function CakeImportPage() {
  const { api } = useAuth(); const navigate = useNavigate(); const queryClient = useQueryClient()
  const folderInput = useRef<HTMLInputElement>(null)
  const [workbook, setWorkbook] = useState<CakeWorkbook | null>(null); const [mapping, setMapping] = useState<CakeColumnMapping>({}); const [files, setFiles] = useState<File[]>([]); const [sourceError, setSourceError] = useState<string | null>(null); const [runError, setRunError] = useState<string | null>(null); const [progress, setProgress] = useState<{ phase: 'photos' | 'products'; done: number; total: number } | null>(null); const [completed, setCompleted] = useState(false)
  useEffect(() => { folderInput.current?.setAttribute('webkitdirectory', ''); folderInput.current?.setAttribute('directory', '') }, [])
  const products = useMemo(() => workbook ? buildCakeImportProducts(workbook.rows, mapping) : [], [workbook, mapping])
  const imageMatches = useMemo(() => matchCakeImages(products, files), [products, files])
  const errors = useMemo(() => products.flatMap((product) => {
    const image = imageMatches.get(product.key)
    const imageError = image?.file && !supportedImageTypes.has(image.file.type) ? `Файл «${image.file.name}» имеет неподдерживаемый формат.` : image?.file && image.file.size > maxImageBytes ? `Файл «${image.file.name}» больше 10 МБ.` : image?.error
    return [...product.errors, imageError].filter((value): value is string => Boolean(value)).map((error) => ({ rows: product.rowNumbers.join(', '), error }))
  }), [imageMatches, products])
  const missingMappings = ['category', 'name', 'price'].filter((field) => !mapping[field as CakeImportField])
  const candidateProducts = products.map((product) => ({ ...product.product, imageUrl: imageMatches.get(product.key)?.file ? '/uploads/will-be-set-after-upload' : null }))
  const validRequest = importCakeProductsRequestSchema.safeParse({ products: candidateProducts }).success
  const imageReferences = products.filter((product) => product.imageReference); const matchedImages = imageReferences.filter((product) => imageMatches.get(product.key)?.file).length
  const canImport = Boolean(workbook && products.length && !missingMappings.length && !errors.length && validRequest && !progress && !completed)

  const readWorkbook = async (file?: File) => {
    if (!file) return; setSourceError(null); setRunError(null); setCompleted(false)
    try { const next = await parseCakeWorkbook(file); setWorkbook(next); setMapping(suggestCakeColumnMapping(next.headers)) } catch (error) { setWorkbook(null); setMapping({}); setSourceError(error instanceof Error ? error.message : 'Не удалось прочитать Excel-файл.') }
  }
  const importProducts = async () => {
    if (!canImport) return; setRunError(null)
    try {
      const uniqueFiles = [...new Set(imageReferences.map((product) => imageMatches.get(product.key)?.file).filter((file): file is File => Boolean(file)))]; const uploaded = new Map<File, string>()
      setProgress({ phase: 'photos', done: 0, total: uniqueFiles.length })
      for (let index = 0; index < uniqueFiles.length; index += 1) { const result = await uploadMediaFile(api, uniqueFiles[index]); uploaded.set(uniqueFiles[index], result.asset.publicUrl); setProgress({ phase: 'photos', done: index + 1, total: uniqueFiles.length }) }
      setProgress({ phase: 'products', done: 0, total: 1 })
      const payload = importCakeProductsRequestSchema.parse({
        products: products.map((product) => {
          const image = imageMatches.get(product.key)?.file
          return { ...product.product, imageUrl: image ? uploaded.get(image) ?? null : null }
        }),
      })
      await api.request('/api/admin/products/import-cakes', productListResponseSchema, { method: 'POST', body: payload })
      setProgress({ phase: 'products', done: 1, total: 1 }); await queryClient.invalidateQueries({ queryKey: ['admin', 'products', 'CAKE'] }); await queryClient.invalidateQueries({ queryKey: ['admin', 'media'] }); setCompleted(true)
    } catch (error) { setRunError(error instanceof Error ? error.message : 'Импорт остановлен. Уже загруженные фотографии останутся в медиатеке и не будут дублироваться при повторе.') } finally { setProgress(null) }
  }
  return <section className="admin-page admin-page-editor admin-menu-import-page"><AdminPageHeader eyebrow="Кондитерская" title="Импорт тортов из Excel" description="Одинаковые название и категория объединятся в одну карточку торта с вариантами веса и цены." actions={<Button asChild variant="outline"><Link to="/products/cakes">К тортам</Link></Button>} />
    <Card className="admin-editor-surface"><CardHeader><CardTitle>1. Источники</CardTitle><CardDescription>Выберите таблицу и папку Obsidian с изображениями.</CardDescription></CardHeader><CardContent className="admin-form-stack"><div className="admin-form-grid-2"><AdminField label="Excel-файл" hint={workbook ? `Лист «${workbook.sheetName}» · ${workbook.rows.length} строк` : 'XLSX, XLS или CSV.'}><Input accept=".xlsx,.xls,.csv" disabled={Boolean(progress)} type="file" onChange={(event) => void readWorkbook(event.target.files?.[0])} /></AdminField><AdminField label="Папка с фотографиями" hint={files.length ? `Найдено файлов: ${files.length}` : 'Выберите папку images. ZIP не нужен.'}><Input ref={folderInput} accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(progress)} multiple type="file" onChange={(event) => { setFiles([...event.target.files ?? []]); setCompleted(false) }} /></AdminField></div><AdminFormIntro>Поддерживаются <code>![](images/medovik.webp)</code> и внешние ссылки на файл: они оба привяжутся к локальному изображению.</AdminFormIntro>{sourceError ? <p className="admin-state-message admin-state-error">{sourceError}</p> : null}</CardContent></Card>
    {workbook ? <Card className="admin-editor-surface"><CardHeader><CardTitle>2. Колонки таблицы</CardTitle><CardDescription>Одна строка — один вариант. Повторите название и категорию для нескольких размеров одного торта.</CardDescription></CardHeader><CardContent className="admin-form-stack"><div className="admin-form-grid-2">{primaryFields.map((field) => <Column field={field} headers={workbook.headers} key={field} mapping={mapping} onChange={setMapping} required={field !== 'image' && field !== 'weight'} />)}</div><details className="admin-advanced-fields"><summary>Дополнительные поля</summary><div className="admin-form-grid-2 pt-4">{optionalFields.map((field) => <Column field={field} headers={workbook.headers} key={field} mapping={mapping} onChange={setMapping} />)}</div></details>{missingMappings.length ? <p className="admin-state-message admin-state-error">Укажите колонки: {missingMappings.map((field) => cakeImportFieldLabels[field as CakeImportField].toLocaleLowerCase('ru')).join(', ')}.</p> : null}</CardContent></Card> : null}
    {workbook && !missingMappings.length ? <Card className="admin-editor-surface"><CardHeader><CardTitle>3. Предпросмотр</CardTitle><CardDescription>Ни товары, ни изображения не создаются, пока вы не нажали кнопку импорта.</CardDescription></CardHeader><CardContent className="admin-form-stack"><div className="admin-menu-import-summary"><span><strong>{products.length}</strong> тортов</span><span><strong>{products.reduce((count, product) => count + product.product.variants.length, 0)}</strong> вариантов</span><span><strong>{matchedImages} из {imageReferences.length}</strong> фото найдено</span><span className={errors.length ? 'is-error' : undefined}><strong>{errors.length}</strong> ошибок</span></div>{errors.length ? <div className="admin-menu-import-errors"><strong>Исправьте перед импортом</strong><ul>{errors.slice(0, 12).map((entry, index) => <li key={`${entry.rows}:${index}`}>Строки {entry.rows}: {entry.error}</li>)}</ul></div> : <div className="admin-help-note"><strong>Проверка пройдена</strong><p>Все торты появятся черновиками. После импорта проверьте их и опубликуйте нужные позиции.</p></div>}<div className="admin-menu-import-sample">{products.slice(0, 6).map((product) => <div key={product.key}><span>{product.product.category}</span><strong>{product.product.name}</strong><small>{product.product.variants.length} {product.product.variants.length === 1 ? 'вариант' : 'варианта'} · {product.product.variants[0]?.priceKopecks / 100 || 0} ₽</small></div>)}</div></CardContent></Card> : null}
    {workbook ? <Card className="admin-editor-surface"><CardHeader><CardTitle>4. Импорт</CardTitle><CardDescription>Импорт создаёт новые карточки тортов и не меняет уже существующие.</CardDescription></CardHeader><CardContent className="admin-form-stack">{progress ? <div className="admin-menu-import-progress"><div><strong>{progress.phase === 'photos' ? 'Загружаем фотографии' : 'Создаём карточки тортов'}</strong><span>{progress.done} из {progress.total}</span></div><Progress value={progress.total ? progress.done / progress.total * 100 : 100} /></div> : null}{runError ? <p className="admin-state-message admin-state-error">{runError}</p> : null}{completed ? <div className="admin-help-note"><strong>Импорт завершён</strong><p>Все новые торты сохранены как черновики.</p><Button className="mt-3" type="button" onClick={() => void navigate({ to: '/products/cakes' })}>Открыть торты</Button></div> : <div className="admin-form-actions"><Button disabled={!canImport} size="lg" type="button" onClick={() => void importProducts()}>Импортировать {products.length} тортов</Button></div>}</CardContent></Card> : null}
  </section>
}
function Column({ field, headers, mapping, onChange, required = false }: { field: CakeImportField; headers: string[]; mapping: CakeColumnMapping; onChange: (value: CakeColumnMapping) => void; required?: boolean }) { return <AdminField label={cakeImportFieldLabels[field]} required={required}><select value={mapping[field] ?? ''} onChange={(event) => onChange({ ...mapping, [field]: event.target.value || undefined })}><option value="">Не импортировать</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></AdminField> }
