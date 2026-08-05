import { createMiddleware } from 'hono/factory'
import { hasPermission, type StaffPermission } from '@chashka-coffee/contracts'

import { AppError } from '../../../http/errors'
import type { AuthenticatedPrincipal } from '../domain/user'
import { executeAuth } from './errors'

export type AuthHttpEnv = {
  Variables: {
    user: AuthenticatedPrincipal
  }
}

export function createRequirePermission(permission: StaffPermission) {
  return createMiddleware<AuthHttpEnv>(async (c, next) => {
    if (!hasPermission(c.var.user, permission)) {
      throw new AppError(403, 'FORBIDDEN', 'Your account does not have permission for this action')
    }
    await next()
  })
}

export function createRequireAnyPermission(permissions: readonly StaffPermission[]) {
  return createMiddleware<AuthHttpEnv>(async (c, next) => {
    if (!permissions.some((permission) => hasPermission(c.var.user, permission))) {
      throw new AppError(403, 'FORBIDDEN', 'Your account does not have permission for this action')
    }
    await next()
  })
}

export function createRequireAuth(
  authenticate: (accessToken: string | undefined) => Promise<AuthenticatedPrincipal>,
) {
  return createMiddleware<AuthHttpEnv>(async (c, next) => {
    const accessToken = bearerToken(c.req.header('authorization'))
    const user = await executeAuth(() => authenticate(accessToken))
    c.set('user', user)
    await next()
  })
}

function bearerToken(authorization: string | undefined) {
  if (!authorization?.startsWith('Bearer ')) return undefined
  return authorization.slice('Bearer '.length)
}
