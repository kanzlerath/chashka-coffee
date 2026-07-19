import { expect, test } from 'bun:test'

import { AppError } from '../../../http/errors'
import { CatalogConflictError } from '../application/errors'
import { toCatalogAppError } from './errors'

test('maps a duplicate restaurant slug to a client-safe conflict response', () => {
  const error = toCatalogAppError(new CatalogConflictError('restaurant_slug'))

  expect(error).toBeInstanceOf(AppError)
  expect(error).toMatchObject({
    status: 409,
    code: 'CONFLICT',
    message: 'Этот адрес страницы уже занят. Укажите другой.',
  })
})
