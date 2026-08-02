import { AppError } from '../../../http/errors'
import { CustomerAccountFailure } from '../domain/errors'

export function toCustomerAccountAppError(error: unknown) {
  if (!(error instanceof CustomerAccountFailure)) return error

  switch (error.code) {
    case 'customer_not_registered':
      return new AppError(404, 'CUSTOMER_NOT_REGISTERED', error.message)
    case 'customer_blocked':
      return new AppError(403, 'CUSTOMER_BLOCKED', error.message)
    case 'code_expired':
      return new AppError(400, 'CODE_EXPIRED', error.message)
    case 'code_invalid':
      return new AppError(400, 'CODE_INVALID', error.message)
    case 'too_many_attempts':
      return new AppError(429, 'TOO_MANY_ATTEMPTS', error.message)
    case 'too_many_requests':
      return new AppError(429, 'TOO_MANY_REQUESTS', error.message)
    case 'session_invalid':
      return new AppError(401, 'UNAUTHORIZED', error.message)
    case 'loyalty_unavailable':
      return new AppError(503, 'LOYALTY_UNAVAILABLE', error.message)
  }
}

export async function executeCustomerAccount<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toCustomerAccountAppError(error)
  }
}

