import { userRoleSchema, type UserDto, type UserRole } from '@chashka-coffee/contracts'

export type AuthUserRecord = {
  id: string
  email: string
  passwordHash: string | null
  displayName: string | null
  role: UserRole | 'ADMIN' | 'EDITOR'
  roles: (UserRole | 'ADMIN' | 'EDITOR')[]
  createdAt: Date
}

export type AuthenticatedPrincipal = UserDto & {
  sessionId: string
}

export function toBaseUserDto(user: AuthUserRecord): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: effectiveRoles(user),
    createdAt: user.createdAt.toISOString(),
  }
}

export function effectiveRoles(user: Pick<AuthUserRecord, 'role' | 'roles'>): UserRole[] {
  const assigned = user.roles.flatMap((role) => {
    const parsed = userRoleSchema.safeParse(role)
    return parsed.success ? [parsed.data] : []
  })
  if (assigned.length > 0) return assigned
  return user.role === 'ADMIN' ? ['SUPER_ADMIN'] : ['CATALOG_MANAGER']
}

export function userDtoFromPrincipal(principal: AuthenticatedPrincipal): UserDto {
  const { sessionId: _sessionId, ...user } = principal
  return user
}
