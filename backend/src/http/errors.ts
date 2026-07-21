import type { ApiErrorCode, ApiErrorResponse } from '@chashka-coffee/contracts'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'

import { Prisma } from '../generated/prisma/client'

export class AppError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  }
}

type ValidationHookResult = { success: true } | { success: false; error: ZodError }

export function validationErrorResponse(details: unknown) {
  return errorResponse('VALIDATION_ERROR', 'Invalid request payload', details)
}

export function validationErrorHook(result: ValidationHookResult, c: Context) {
  if (!result.success) {
    return c.json(validationErrorResponse(result.error.issues), 400)
  }
}

export function handleError(error: Error, c: Context) {
  if (error instanceof AppError) {
    return c.json(errorResponse(error.code, error.message, error.details), error.status)
  }

  if (error instanceof ZodError) {
    return c.json(validationErrorResponse(error.issues), 400)
  }

  if (error instanceof HTTPException) {
    return c.json(errorResponse('BAD_REQUEST', error.message), error.status)
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return c.json(errorResponse('CONFLICT', 'Этот адрес страницы уже занят. Укажите другой.'), 409)
    }
    if (error.code === 'P2003') {
      return c.json(errorResponse('CONFLICT', 'Запись используется в другом разделе. Сначала уберите связанные данные.'), 409)
    }
    if (error.code === 'P2025') {
      return c.json(errorResponse('NOT_FOUND', 'Запись не найдена.'), 404)
    }
  }

  console.error(error)
  return c.json(errorResponse('INTERNAL_ERROR', 'Unexpected server error'), 500)
}
