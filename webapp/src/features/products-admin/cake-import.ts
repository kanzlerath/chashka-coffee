import { upsertProductRequestSchema, type UpsertProductRequest } from '@chashka-coffee/contracts'

import { toPublicSlug } from '@/lib/slugify'

export const cakeImportFieldLabels = {
  category: 'Категория',
  name: 'Название торта',
  subtitle: 'Короткая подпись',
  description: 'Описание',
  ingredients: 'Состав',
  image: 'Фото',
  variant: 'Вариант',
  weight: 'Вес, г',
  price: 'Цена, ₽',
  available: 'В продаже',
  featured: 'Избранное',
  position: 'Порядок',
} as const

export type CakeImportField = keyof typeof cakeImportFieldLabels
export type CakeColumnMapping = Partial<Record<CakeImportField, string>>
export type CakeWorkbook = { headers: string[]; rows: Array<{ rowNumber: number; values: Record<string, string> }>; sheetName: string }
export type CakeImportProduct = { key: string; rowNumbers: number[]; imageReference: string | null; product: UpsertProductRequest; errors: string[] }
export type CakeImageMatch = { file: File | null; error: string | null }

const aliases: Partial<Record<CakeImportField, string[]>> = {
  category: ['категория', 'раздел'], name: ['название', 'наименование', 'торт'], subtitle: ['короткая подпись', 'подпись'], description: ['описание'], ingredients: ['состав', 'ингредиенты'], image: ['фото', 'изображение', 'картинка', 'image'], variant: ['вариант', 'размер', 'весовка'], weight: ['вес', 'вес г', 'вес, г', 'граммы'], price: ['цена', 'стоимость', 'price'], available: ['в продаже', 'наличие', 'доступен'], featured: ['избранное', 'рекомендуем', 'хит'], position: ['порядок', 'позиция'],
}

export async function parseCakeWorkbook(file: File): Promise<CakeWorkbook> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('В файле не найден ни один лист.')
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false })
  const [headerRow, ...dataRows] = matrix
  const headers = (headerRow ?? []).map((value, index) => String(value).trim() || `Колонка ${index + 1}`)
  if (!headers.length) throw new Error('В первой строке не найдены заголовки колонок.')
  if (new Set(headers).size !== headers.length) throw new Error('В таблице есть одинаковые заголовки колонок. Переименуйте их.')
  return { sheetName, headers, rows: dataRows.map((row, index) => ({ rowNumber: index + 2, values: Object.fromEntries(headers.map((header, column) => [header, String(row[column] ?? '').trim()])) })).filter((row) => Object.values(row.values).some(Boolean)) }
}

export function suggestCakeColumnMapping(headers: string[]): CakeColumnMapping {
  return Object.fromEntries((Object.keys(cakeImportFieldLabels) as CakeImportField[]).flatMap((field) => {
    const column = headers.find((header) => (aliases[field] ?? []).includes(normalizeHeader(header)))
    return column ? [[field, column]] : []
  }))
}

export function buildCakeImportProducts(rows: CakeWorkbook['rows'], mapping: CakeColumnMapping): CakeImportProduct[] {
  const products = new Map<string, CakeImportProduct>()
  rows.forEach((row, index) => {
    const value = (field: CakeImportField) => mapping[field] ? row.values[mapping[field]!] ?? '' : ''
    const category = value('category').trim()
    const name = value('name').trim()
    const key = `${category.toLocaleLowerCase('ru')}::${name.toLocaleLowerCase('ru')}`
    const weight = parseInteger(value('weight'))
    const variantLabel = value('variant').trim() || (weight ? `${weight} г` : '')
    const errors = [
      !category ? 'Не указана категория.' : null,
      !name ? 'Не указано название торта.' : null,
      name && !toPublicSlug(name) ? 'Не удалось сформировать адрес торта.' : null,
      !variantLabel ? 'Укажите вариант или вес торта.' : null,
    ].filter((error): error is string => Boolean(error))
    const product = products.get(key)
    if (!product) {
      products.set(key, {
        key, rowNumbers: [row.rowNumber], imageReference: imageReference(value('image')),
        product: {
          type: 'CAKE', status: 'DRAFT', publishAt: null, slug: toPublicSlug(name), name, category: nullable(category), subtitle: nullable(value('subtitle')), description: nullable(value('description')), ingredients: nullable(value('ingredients')), origin: null, roastLevel: null, tastingNotes: [], imageUrl: null, galleryUrls: [], details: [], blocks: [], isFeatured: parseBoolean(value('featured')), position: parseInteger(value('position')) ?? (index + 1) * 10,
          variants: [{ label: variantLabel, weightGrams: weight, priceKopecks: parsePrice(value('price')), position: 10, isAvailable: value('available') ? parseBoolean(value('available')) : true }],
        }, errors,
      })
      return
    }
    product.rowNumbers.push(row.rowNumber)
    const nextImage = imageReference(value('image'))
    if (nextImage && product.imageReference && nextImage !== product.imageReference) product.errors.push('У одного торта указаны разные фотографии.')
    if (!product.imageReference && nextImage) product.imageReference = nextImage
    product.product.variants.push({ label: variantLabel, weightGrams: weight, priceKopecks: parsePrice(value('price')), position: product.product.variants.length * 10 + 10, isAvailable: value('available') ? parseBoolean(value('available')) : true })
    product.product.isFeatured ||= parseBoolean(value('featured'))
  })
  return [...products.values()].map((product) => ({ ...product, errors: [...product.errors, ...validateProduct(product.product)] }))
}

export function matchCakeImages(products: CakeImportProduct[], files: File[]): Map<string, CakeImageMatch> {
  const byPath = new Map<string, File[]>()
  const byName = new Map<string, File[]>()
  files.forEach((file) => {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    add(byPath, path(relative), file); add(byPath, path(relative.split('/').slice(1).join('/') || relative), file); add(byName, path(file.name), file)
  })
  return new Map<string, CakeImageMatch>(products.map((product): [string, CakeImageMatch] => {
    if (!product.imageReference) return [product.key, { file: null, error: null }]
    const reference = path(product.imageReference)
    const candidates = byPath.get(reference) ?? byPath.get(reference.replace(/^images\//, '')) ?? byName.get(reference.split('/').at(-1) ?? reference) ?? []
    if (candidates.length === 1) return [product.key, { file: candidates[0], error: null }]
    if (candidates.length > 1) return [product.key, { file: null, error: `Несколько файлов подходят к «${product.imageReference}».` }]
    return [product.key, { file: null, error: `Не найден файл «${product.imageReference}».` }]
  }))
}

function validateProduct(product: UpsertProductRequest) {
  const result = upsertProductRequestSchema.safeParse(product)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.includes('priceKopecks') ? 'Укажите корректную цену.' : issue.path.includes('weightGrams') ? 'Вес должен быть целым положительным числом.' : issue.message)
}
function normalizeHeader(value: string) { return value.toLocaleLowerCase('ru').replace(/[._/\\-]+/g, ' ').replace(/\s+/g, ' ').trim() }
function nullable(value: string) { return value.trim() || null }
function parseInteger(value: string) { const parsed = parseDecimal(value); return parsed !== null && Number.isInteger(parsed) ? parsed : null }
function parseDecimal(value: string) { const normalized = value.replace(/[\s\u00a0]/g, '').replace(',', '.').replace(/[^\d.-]/g, ''); const parsed = Number(normalized); return normalized && Number.isFinite(parsed) ? parsed : null }
function parsePrice(value: string) { const parsed = parseDecimal(value); return parsed === null ? Number.NaN : Math.round(parsed * 100) }
function parseBoolean(value: string) { return ['1', 'true', 'да', 'yes', 'y', 'x', '✓', '+'].includes(value.trim().toLocaleLowerCase('ru')) }
function imageReference(value: string) { const markdown = value.match(/!\[[^\]]*\]\((?:<)?([^\s>)]+)(?:\s+[^)]*)?\)/); const wiki = value.match(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/); const raw = (markdown?.[1] ?? wiki?.[1] ?? value).trim().replace(/^['"]|['"]$/g, ''); if (!raw) return null; try { return decodeURIComponent(new URL(raw).pathname) } catch { try { return decodeURIComponent(raw) } catch { return raw } } }
function path(value: string) { return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '').toLocaleLowerCase('ru') }
function add(index: Map<string, File[]>, key: string, file: File) { index.set(key, [...(index.get(key) ?? []), file]) }
