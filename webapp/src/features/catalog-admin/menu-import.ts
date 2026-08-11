import { upsertMenuItemRequestSchema, type MenuItemMeasurementUnit, type UpsertMenuItemRequest } from '@chashka-coffee/contracts'

import { toPublicSlug } from '@/lib/slugify'

export const importFieldLabels = {
  category: 'Категория',
  name: 'Название блюда',
  price: 'Цена, ₽',
  weight: 'Вес / объём',
  unit: 'Единица измерения',
  description: 'Описание',
  ingredients: 'Состав',
  calories: 'Ккал',
  proteins: 'Белки',
  fats: 'Жиры',
  carbohydrates: 'Углеводы',
  labels: 'Метки',
  vegetarian: 'Вегетарианское',
  spicy: 'Острое',
  lactoseFree: 'Без лактозы',
  glutenFree: 'Без глютена',
  light: 'Лёгкое',
  badge: 'Бейдж',
  image: 'Фото',
} as const

export type ImportField = keyof typeof importFieldLabels
export type ColumnMapping = Partial<Record<ImportField, string>>

export type RawMenuRow = { rowNumber: number; values: Record<string, string> }
export type ParsedWorkbook = { headers: string[]; rows: RawMenuRow[]; sheetName: string }
export type ImportRow = {
  rowNumber: number
  categoryName: string
  categorySlug: string
  imageReference: string | null
  item: UpsertMenuItemRequest
  errors: string[]
}

const defaultAliases: Partial<Record<ImportField, string[]>> = {
  category: ['категория', 'раздел', 'группа'],
  name: ['название', 'наименование', 'блюдо', 'позиция'],
  price: ['цена', 'стоимость', 'price'],
  weight: ['вес', 'объем', 'объём', 'выход', 'вес объем', 'вес объём'],
  unit: ['ед измерения', 'ед изм', 'единица измерения', 'единица'],
  description: ['описание'],
  ingredients: ['состав', 'ингредиенты'],
  calories: ['ккал', 'калории', 'калорийность'],
  proteins: ['белки'],
  fats: ['жиры'],
  carbohydrates: ['углеводы'],
  labels: ['метки', 'особенности', 'диетические метки'],
  vegetarian: ['вегетарианское', 'веганское'],
  spicy: ['острое', 'острый'],
  lactoseFree: ['без лактозы'],
  glutenFree: ['без глютена'],
  light: ['лёгкое', 'легкое'],
  badge: ['бейдж', 'ярлык'],
  image: ['фото', 'изображение', 'картинка', 'image'],
}

export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('В файле не найден ни один лист.')
  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
  const [headerRow, ...dataRows] = matrix
  const headers = (headerRow ?? []).map((value, index) => String(value).trim() || `Колонка ${index + 1}`)
  if (!headers.length) throw new Error('В первой строке таблицы не найдены заголовки колонок.')
  if (new Set(headers).size !== headers.length) throw new Error('В таблице есть одинаковые заголовки колонок. Переименуйте их, чтобы импортёр мог различать поля.')

  return {
    headers,
    sheetName,
    rows: dataRows
      .map((row, index) => ({
        rowNumber: index + 2,
        values: Object.fromEntries(headers.map((header, column) => [header, cleanCell(row[column])])),
      }))
      .filter((row) => Object.values(row.values).some(Boolean)),
  }
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const normalizedHeaders = headers.map((header) => [header, normalizeHeader(header)] as const)
  return Object.fromEntries(
    (Object.keys(importFieldLabels) as ImportField[])
      .map((field) => {
        const aliases = defaultAliases[field] ?? []
        const matched = normalizedHeaders.find(([, header]) => aliases.includes(header))?.[0]
        return matched ? [field, matched] : null
      })
      .filter((value): value is [ImportField, string] => value !== null),
  )
}

export function buildImportRows(rows: RawMenuRow[], mapping: ColumnMapping): ImportRow[] {
  const duplicateItems = new Map<string, number>()

  const imported = rows.map((row, index) => {
    const value = (field: ImportField) => mapping[field] ? row.values[mapping[field]!] ?? '' : ''
    const categoryName = value('category').trim()
    const name = value('name').trim()
    const parsedWeight = parseWeight(value('weight'))
    const labels = value('labels')
    const categorySlug = toPublicSlug(categoryName)
    const item: UpsertMenuItemRequest = {
      slug: toPublicSlug(name),
      name,
      description: nullable(value('description')),
      ingredients: nullable(value('ingredients')),
      weightGrams: parsedWeight.value,
      measurementUnit: parseUnit(value('unit')) ?? parsedWeight.unit ?? 'GRAM',
      priceKopecks: parsePrice(value('price')),
      calories: parseInteger(value('calories')),
      proteins: parseDecimal(value('proteins')),
      fats: parseDecimal(value('fats')),
      carbohydrates: parseDecimal(value('carbohydrates')),
      isVegetarian: parseBoolean(value('vegetarian')) || hasLabel(labels, ['вегетариан', 'веган']),
      isSpicy: parseBoolean(value('spicy')) || hasLabel(labels, ['остр']),
      isLactoseFree: parseBoolean(value('lactoseFree')) || hasLabel(labels, ['без лактоз']),
      isGlutenFree: parseBoolean(value('glutenFree')) || hasLabel(labels, ['без глютен']),
      isLight: parseBoolean(value('light')) || hasLabel(labels, ['легк', 'лёгк']),
      marketingBadge: parseBadge(value('badge')),
      imageUrl: null,
      position: (index + 1) * 10,
    }
    const errors = [...validateRequired(categoryName, name), ...validateItem(item)]
    return { rowNumber: row.rowNumber, categoryName, categorySlug, imageReference: imageReference(value('image')), item, errors }
  })

  for (const row of imported) {
    const itemKey = `${row.categorySlug}:${row.item.slug}`
    duplicateItems.set(itemKey, (duplicateItems.get(itemKey) ?? 0) + 1)
  }
  for (const row of imported) {
    if (row.categoryName && !row.categorySlug) row.errors.push('Не удалось сформировать адрес категории.')
    if (duplicateItems.get(`${row.categorySlug}:${row.item.slug}`)! > 1) row.errors.push('В этой категории есть несколько строк с одинаковым названием.')
  }
  return imported
}

export type ImageMatch = { file: File | null; error: string | null }

export function matchImages(rows: ImportRow[], files: File[]): Map<number, ImageMatch> {
  const byPath = new Map<string, File[]>()
  const byFilename = new Map<string, File[]>()
  for (const file of files) {
    const relative = fileRelativePath(file)
    addFile(byPath, normalizePath(relative), file)
    addFile(byPath, normalizePath(removeLeadingFolder(relative)), file)
    addFile(byFilename, normalizePath(file.name), file)
  }

  return new Map<number, ImageMatch>(rows.map((row): [number, ImageMatch] => {
    if (!row.imageReference) return [row.rowNumber, { file: null, error: null }]
    const reference = normalizePath(row.imageReference)
    const exact = byPath.get(reference) ?? byPath.get(normalizePath(stripImagesPrefix(reference)))
    const candidates = exact ?? byFilename.get(fileNameFromPath(reference)) ?? []
    if (candidates.length === 1) return [row.rowNumber, { file: candidates[0], error: null }]
    if (candidates.length > 1) return [row.rowNumber, { file: null, error: `Несколько файлов подходят к «${row.imageReference}».` }]
    return [row.rowNumber, { file: null, error: `Не найден файл «${row.imageReference}».` }]
  }))
}

function cleanCell(value: unknown) { return String(value ?? '').replace(/\r\n/g, '\n').trim() }
function normalizeHeader(value: string) { return value.toLocaleLowerCase('ru').replace(/[._/\\-]+/g, ' ').replace(/\s+/g, ' ').trim() }
function nullable(value: string) { const trimmed = value.trim(); return trimmed || null }
function parseInteger(value: string) { const parsed = parseDecimal(value); return parsed === null ? null : Number.isInteger(parsed) ? parsed : null }
function parseDecimal(value: string) {
  const normalized = value.replace(/[\s\u00a0]/g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  if (!normalized || normalized === '-' || normalized === '.') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}
function parsePrice(value: string) { const parsed = parseDecimal(value); return parsed === null ? Number.NaN : Math.round(parsed * 100) }
function parseBoolean(value: string) { return ['1', 'true', 'да', 'yes', 'y', 'x', '✓', '+'].includes(value.trim().toLocaleLowerCase('ru')) }
function hasLabel(value: string, labels: string[]) { const normalized = value.toLocaleLowerCase('ru'); return labels.some((label) => normalized.includes(label)) }
function parseUnit(value: string): MenuItemMeasurementUnit | null {
  const normalized = value.trim().toLocaleLowerCase('ru').replace('.', '')
  if (!normalized) return null
  if (['г', 'гр', 'грамм', 'граммы', 'gram', 'grams'].includes(normalized)) return 'GRAM'
  if (['мл', 'миллилитр', 'миллилитры', 'ml'].includes(normalized)) return 'MILLILITER'
  if (['шт', 'штука', 'штуки', 'piece', 'pcs'].includes(normalized)) return 'PIECE'
  return null
}
function parseWeight(value: string) {
  const parsed = parseInteger(value)
  const normalized = value.toLocaleLowerCase('ru')
  return { value: parsed, unit: /(мл|ml|миллилит)/.test(normalized) ? 'MILLILITER' as const : /(шт|pcs|piece|штук)/.test(normalized) ? 'PIECE' as const : null }
}
function parseBadge(value: string): UpsertMenuItemRequest['marketingBadge'] {
  const normalized = value.trim().toLocaleLowerCase('ru')
  if (!normalized) return null
  if (['new', 'новинка'].includes(normalized)) return 'NEW'
  if (['hit', 'хит'].includes(normalized)) return 'HIT'
  if (['seasonal', 'сезонное', 'сезонный'].includes(normalized)) return 'SEASONAL'
  if (['special', 'специальное', 'спецпредложение'].includes(normalized)) return 'SPECIAL'
  return null
}
function validateRequired(categoryName: string, name: string) {
  const errors: string[] = []
  if (!categoryName) errors.push('Не указана категория.')
  if (!name) errors.push('Не указано название блюда.')
  if (name && !toPublicSlug(name)) errors.push('Не удалось сформировать адрес блюда.')
  return errors
}
function validateItem(item: UpsertMenuItemRequest) {
  const result = upsertMenuItemRequestSchema.safeParse(item)
  return result.success ? [] : result.error.issues.map((issue) => {
    if (issue.path[0] === 'priceKopecks') return 'Укажите корректную цену.'
    if (issue.path[0] === 'weightGrams') return 'Вес или объём должен быть целым положительным числом.'
    if (issue.path[0] === 'calories') return 'Калорийность должна быть целым неотрицательным числом.'
    return issue.message
  })
}
function imageReference(value: string) {
  const markdown = value.match(/!\[[^\]]*\]\((?:<)?([^\s>)]+)(?:\s+[^)]*)?\)/)
  const wiki = value.match(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/)
  const raw = markdown?.[1] ?? wiki?.[1] ?? value.trim()
  if (!raw) return null
  const unquoted = raw.replace(/^['"]|['"]$/g, '')
  try {
    const url = new URL(unquoted)
    return decodeURIComponent(url.pathname)
  } catch {
    try { return decodeURIComponent(unquoted) } catch { return unquoted }
  }
}
function fileRelativePath(file: File) { return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name }
function normalizePath(value: string) { return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '').toLocaleLowerCase('ru') }
function removeLeadingFolder(value: string) { return value.split('/').slice(1).join('/') || value }
function stripImagesPrefix(value: string) { return value.replace(/^images\//, '') }
function fileNameFromPath(value: string) { return value.split('/').filter(Boolean).at(-1) ?? value }
function addFile(index: Map<string, File[]>, key: string, file: File) { index.set(key, [...(index.get(key) ?? []), file]) }
