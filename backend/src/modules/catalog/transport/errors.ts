import { AppError } from '../../../http/errors'
import { CatalogConflictError } from '../application/errors'

export function toCatalogAppError(error: unknown) {
  if (error instanceof CatalogConflictError && error.kind === 'restaurant_slug') {
    return new AppError(409, 'CONFLICT', 'Этот адрес страницы уже занят. Укажите другой.')
  }

  return error
}

export async function executeCatalog<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toCatalogAppError(error)
  }
}
