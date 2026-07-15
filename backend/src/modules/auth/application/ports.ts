import type { CreateStaffUserRequest, RegisterPayload, UserDto, UserRole } from '@chashka-coffee/contracts'

import type { SessionMetadata } from '../domain/session'
import type { AuthUserRecord } from '../domain/user'

export type AccessTokenPayload = {
  sub: string
  sessionId: string
  email: string
}

export type AuthRepository = {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>
  countUsers(): Promise<number>
  createPasswordUser(input: RegisterPayload & { passwordHash: string; role: UserRole }): Promise<AuthUserRecord>
  createSession(input: {
    userId: string
    refreshTokenHash: string
    expiresAt: Date
    metadata: SessionMetadata
  }): Promise<{ id: string }>
  findActiveRefreshSession(input: {
    refreshTokenHash: string
    now: Date
  }): Promise<{ id: string; userId: string; user: AuthUserRecord } | null>
  rotateRefreshSession(input: {
    currentSessionId: string
    userId: string
    now: Date
    nextRefreshTokenHash: string
    nextExpiresAt: Date
    metadata: SessionMetadata
  }): Promise<{ id: string } | null>
  findActiveAccessSession(input: {
    sessionId: string
    userId: string
    now: Date
  }): Promise<{ id: string; user: AuthUserRecord } | null>
  revokeSession(input: { refreshTokenHash: string; now: Date }): Promise<string | null>
  listUsers(): Promise<AuthUserRecord[]>
}

export type AccessTokens = {
  sign(payload: AccessTokenPayload): Promise<string>
  verify(token: string): Promise<AccessTokenPayload>
}

export type Passwords = {
  hash(password: string): Promise<string>
  verify(password: string, passwordHash: string): Promise<boolean>
}

export type RefreshTokens = {
  create(): string
  hash(token: string): string
}

export type Clock = {
  now(): Date
}

export type ProjectUser = (user: AuthUserRecord) => UserDto | Promise<UserDto>
export type LogoutCleanup = (input: { userId: string }) => void | Promise<void>
