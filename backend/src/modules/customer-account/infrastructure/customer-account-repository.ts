import type { DbClient } from '../../../db'
import type { CustomerAccountRepository } from '../application/ports'
import { CustomerAccountFailure } from '../domain/errors'

export function createPrismaCustomerAccountRepository(db: DbClient): CustomerAccountRepository {
  return {
    findRecentSentChallenge(input) {
      return db.customerLoginChallenge.findFirst({
        where: {
          phone: input.phone,
          sentAt: { gt: input.sentAfter },
        },
        orderBy: { sentAt: 'desc' },
        select: { id: true },
      })
    },

    createLoginChallenge(input) {
      return db.customerLoginChallenge.create({
        data: {
          phone: input.phone,
          expiresAt: input.expiresAt,
          createdAt: input.now,
        },
        select: { id: true },
      })
    },

    async markLoginChallengeSent(input) {
      await db.customerLoginChallenge.update({
        where: { id: input.id },
        data: { sentAt: input.sentAt },
      })
    },

    async deleteLoginChallenge(id) {
      await db.customerLoginChallenge.deleteMany({ where: { id } })
    },

    findActiveLoginChallenge(input) {
      return db.customerLoginChallenge.findFirst({
        where: {
          id: input.id,
          sentAt: { not: null },
          consumedAt: null,
          expiresAt: { gt: input.now },
        },
        select: {
          id: true,
          phone: true,
          attemptCount: true,
        },
      })
    },

    async incrementLoginAttempts(id) {
      const challenge = await db.customerLoginChallenge.update({
        where: { id },
        data: { attemptCount: { increment: 1 } },
        select: { attemptCount: true },
      })
      return challenge.attemptCount
    },

    completeLogin(input) {
      return db.$transaction(async (tx) => {
        const consumed = await tx.customerLoginChallenge.updateMany({
          where: {
            id: input.challengeId,
            phone: input.phone,
            sentAt: { not: null },
            consumedAt: null,
            expiresAt: { gt: input.now },
          },
          data: { consumedAt: input.now },
        })
        if (consumed.count !== 1) return null

        const [byProviderId, byPhone] = await Promise.all([
          tx.customerAccount.findUnique({
            where: { premiumBonusClientId: input.providerClientId },
          }),
          tx.customerAccount.findUnique({ where: { phone: input.phone } }),
        ])
        if (byProviderId && byPhone && byProviderId.id !== byPhone.id) {
          throw new CustomerAccountFailure(
            'loyalty_unavailable',
            'Аккаунты PremiumBonus требуют объединения через поддержку',
          )
        }

        const existing = byProviderId ?? byPhone
        const customer = existing
          ? await tx.customerAccount.update({
              where: { id: existing.id },
              data: {
                premiumBonusClientId: input.providerClientId,
                phone: input.phone,
              },
            })
          : await tx.customerAccount.create({
              data: {
                premiumBonusClientId: input.providerClientId,
                phone: input.phone,
              },
            })

        await tx.customerSession.create({
          data: {
            customerId: customer.id,
            sessionTokenHash: input.sessionTokenHash,
            expiresAt: input.sessionExpiresAt,
            ipAddress: input.metadata.ipAddress,
            userAgent: input.metadata.userAgent,
          },
        })
        return { customerId: customer.id }
      })
    },

    findActiveSession(input) {
      return db.customerSession.findFirst({
        where: {
          sessionTokenHash: input.tokenHash,
          revokedAt: null,
          expiresAt: { gt: input.now },
        },
        select: {
          id: true,
          customer: {
            select: {
              id: true,
              premiumBonusClientId: true,
              phone: true,
            },
          },
        },
      }).then((session) => session ? {
        sessionId: session.id,
        customer: {
          id: session.customer.id,
          providerClientId: session.customer.premiumBonusClientId,
          phone: session.customer.phone,
        },
      } : null)
    },

    async revokeSession(input) {
      await db.customerSession.updateMany({
        where: {
          sessionTokenHash: input.tokenHash,
          revokedAt: null,
        },
        data: { revokedAt: input.now },
      })
    },
  }
}

