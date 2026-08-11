import { describe, expect, test } from 'bun:test'

import { buildImportRows, matchImages, parseWorkbook, suggestColumnMapping } from '../src/features/catalog-admin/menu-import'

describe('menu import parsing', () => {
  test('reads rows from the first Excel sheet', async () => {
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Категория', 'Название', 'Цена'], ['Кофе', 'Флэт уайт', 350]]), 'Меню')
    const file = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'menu.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    await expect(parseWorkbook(file)).resolves.toEqual({
      sheetName: 'Меню',
      headers: ['Категория', 'Название', 'Цена'],
      rows: [{ rowNumber: 2, values: { Категория: 'Кофе', Название: 'Флэт уайт', Цена: '350' } }],
    })
  })

  test('suggests Russian columns and normalizes food values', () => {
    const mapping = suggestColumnMapping(['Категория', 'Название', 'Цена', 'Вес', 'Фото', 'Метки'])
    const [row] = buildImportRows([{
      rowNumber: 2,
      values: {
        Категория: 'Кофе',
        Название: 'Капучино',
        Цена: '390 ₽',
        Вес: '300 мл',
        Фото: '![](images/cappuccino.webp)',
        Метки: 'Вегетарианское, без глютена',
      },
    }], mapping)

    expect(mapping).toMatchObject({ category: 'Категория', name: 'Название', price: 'Цена', image: 'Фото' })
    expect(row.errors).toEqual([])
    expect(row.categorySlug).toBe('kofe')
    expect(row.imageReference).toBe('images/cappuccino.webp')
    expect(row.item).toMatchObject({ priceKopecks: 39_000, weightGrams: 300, measurementUnit: 'MILLILITER', isVegetarian: true, isGlutenFree: true })
  })

  test('matches an external Obsidian image reference by a local file name', () => {
    const [row] = buildImportRows([{
      rowNumber: 7,
      values: { Категория: 'Десерты', Название: 'Тарт', Цена: '450', Фото: '![](https://example.test/photo-chk/1_upd.webp)' },
    }], { category: 'Категория', name: 'Название', price: 'Цена', image: 'Фото' })
    const file = new File(['image'], '1_upd.webp', { type: 'image/webp' })

    expect(matchImages([row], [file]).get(7)).toEqual({ file, error: null })
  })

  test('blocks duplicate names inside one category before anything is created', () => {
    const rows = buildImportRows([
      { rowNumber: 2, values: { Категория: 'Кофе', Название: 'Раф', Цена: '390' } },
      { rowNumber: 3, values: { Категория: 'Кофе', Название: 'Раф', Цена: '420' } },
    ], { category: 'Категория', name: 'Название', price: 'Цена' })

    expect(rows.map((row) => row.errors)).toEqual([
      ['В этой категории есть несколько строк с одинаковым названием.'],
      ['В этой категории есть несколько строк с одинаковым названием.'],
    ])
  })
})
