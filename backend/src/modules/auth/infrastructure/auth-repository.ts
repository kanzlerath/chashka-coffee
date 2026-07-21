import type { DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import type { AuthRepository } from '../application/ports'
import { AuthFailure } from '../domain/errors'

export function createPrismaAuthRepository(db: DbClient): AuthRepository {
  return {
    findUserByEmail(email) {
      return db.user.findUnique({ where: { email } })
    },

    findUserById(id) {
      return db.user.findUnique({ where: { id } })
    },

    countUsers() {
      return db.user.count()
    },

    async createPasswordUser(input) {
      try {
        return await db.user.create({
          data: {
            email: input.email,
            passwordHash: input.passwordHash,
            displayName: input.displayName,
            role: input.role,
          },
        })
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new AuthFailure('email_already_exists', 'User with this email already exists')
        }
        throw error
      }
    },

    createSession(input) {
      return db.authSession.create({
        data: {
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          expiresAt: input.expiresAt,
          userAgent: input.metadata.userAgent,
          ipAddress: input.metadata.ipAddress,
        },
        select: { id: true },
      })
    },

    findActiveRefreshSession(input) {
      return db.authSession.findFirst({
        where: {
          refreshTokenHash: input.refreshTokenHash,
          revokedAt: null,
          expiresAt: { gt: input.now },
        },
        include: { user: true },
      })
    },

    rotateRefreshSession(input) {
      return db.$transaction(async (tx) => {
        const revoked = await tx.authSession.updateMany({
          where: {
            id: input.currentSessionId,
            revokedAt: null,
            expiresAt: { gt: input.now },
          },
          data: { revokedAt: input.now },
        })
        if (revoked.count !== 1) return null

        return tx.authSession.create({
          data: {
            userId: input.userId,
            refreshTokenHash: input.nextRefreshTokenHash,
            expiresAt: input.nextExpiresAt,
            userAgent: input.metadata.userAgent,
            ipAddress: input.metadata.ipAddress,
          },
          select: { id: true },
        })
      })
    },

    findActiveAccessSession(input) {
      return db.authSession.findFirst({
        where: {
          id: input.sessionId,
          userId: input.userId,
          revokedAt: null,
          expiresAt: { gt: input.now },
        },
        include: { user: true },
      })
    },

    revokeSession(input) {
      return db.$transaction(async (tx) => {
        const session = await tx.authSession.findFirst({
          where: {
            refreshTokenHash: input.refreshTokenHash,
            revokedAt: null,
          },
          select: { id: true, userId: true },
        })
        if (!session) return null

        const revoked = await tx.authSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: input.now },
        })
        return revoked.count === 1 ? session.userId : null
      })
    },

    listUsers() {
      return db.user.findMany({ orderBy: { createdAt: 'asc' } })
    },

    async updateUser(input) {
      const { id, password, passwordHash, ...data } = input
      try {
        return await db.$transaction(async (tx) => {
          const current = await tx.user.findUnique({ where: { id } })
          if (!current) throw new AuthFailure('staff_not_found', 'Staff user was not found')
          if (current.role === 'ADMIN' && data.role !== 'ADMIN') {
            const adminCount = await tx.user.count({ where: { role: 'ADMIN' } })
            if (adminCount <= 1) throw new AuthFailure('last_admin', 'The last administrator cannot be demoted')
          }
          return tx.user.update({
            where: { id },
            data: {
              email: data.email,
              displayName: data.displayName,
              role: data.role,
              ...(passwordHash ? { passwordHash } : {}),
            },
          })
        })
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new AuthFailure('email_already_exists', 'User with this email already exists')
        }
        throw error
      }
    },

    async deleteUser(id) {
      await db.$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id } })
        if (!current) throw new AuthFailure('staff_not_found', 'Staff user was not found')
        if (current.role === 'ADMIN') {
          const adminCount = await tx.user.count({ where: { role: 'ADMIN' } })
          if (adminCount <= 1) throw new AuthFailure('last_admin', 'The last administrator cannot be deleted')
        }
        await tx.user.delete({ where: { id } })
      })
    },

    async revokeUserSessions(input) {
      await db.authSession.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: input.now },
      })
    },
  }
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}
