import { AppError } from '../../../http/errors'
import { AuthFailure } from '../domain/errors'

export function toAuthAppError(error: unknown) {
  if (!(error instanceof AuthFailure)) return error

  if (error.kind === 'email_already_exists') {
    return new AppError(409, 'CONFLICT', error.message)
  }

  if (error.kind === 'registration_closed') {
    return new AppError(403, 'FORBIDDEN', error.message)
  }

  if (error.kind === 'staff_not_found') {
    return new AppError(404, 'NOT_FOUND', error.message)
  }

  if (error.kind === 'last_admin' || error.kind === 'self_delete') {
    return new AppError(409, 'CONFLICT', error.message)
  }

  return new AppError(401, 'UNAUTHORIZED', error.message)
}

export async function executeAuth<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toAuthAppError(error)
  }
}
