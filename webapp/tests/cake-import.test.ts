import { describe, expect, test } from 'bun:test'

import { buildCakeImportProducts, matchCakeImages, suggestCakeColumnMapping } from '../src/features/products-admin/cake-import'

describe('cake import parsing', () => {
  test('groups the sizes of one cake into variants', () => {
    const mapping = suggestCakeColumnMapping(['Категория', 'Название', 'Вес, г', 'Цена', 'Фото'])
    const products = buildCakeImportProducts([
      { rowNumber: 2, values: { Категория: 'Торты', Название: 'Медовик', 'Вес, г': '1000', Цена: '2500', Фото: '![](images/medovik.webp)' } },
      { rowNumber: 3, values: { Категория: 'Торты', Название: 'Медовик', 'Вес, г': '2000', Цена: '4500', Фото: '![](images/medovik.webp)' } },
    ], mapping)

    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({ imageReference: 'images/medovik.webp', product: { slug: 'medovik', variants: [{ label: '1000 г', priceKopecks: 250000 }, { label: '2000 г', priceKopecks: 450000 }] } })
  })

  test('uses the local image file for an external link', () => {
    const [product] = buildCakeImportProducts([{ rowNumber: 2, values: { Категория: 'Торты', Название: 'Наполеон', Цена: '1900', Вариант: '1 кг', Фото: '![](https://cdn.example.test/photos/napoleon.webp)' } }], { category: 'Категория', name: 'Название', price: 'Цена', variant: 'Вариант', image: 'Фото' })
    const file = new File(['image'], 'napoleon.webp', { type: 'image/webp' })
    expect(matchCakeImages([product], [file]).get(product.key)).toEqual({ file, error: null })
  })

  test('uses an individually selected file for an images-prefixed reference', () => {
    const [product] = buildCakeImportProducts([{ rowNumber: 2, values: { Категория: 'Торты', Название: 'Медовик', Цена: '1800', Вариант: '1 кг', Фото: 'images/medovik.webp' } }], { category: 'Категория', name: 'Название', price: 'Цена', variant: 'Вариант', image: 'Фото' })
    const file = new File(['image'], 'medovik.webp', { type: 'image/webp' })
    expect(matchCakeImages([product], [file]).get(product.key)).toEqual({ file, error: null })
  })
})
