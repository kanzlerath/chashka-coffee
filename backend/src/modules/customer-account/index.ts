import type { DbClient } from '../../db'
import type { AppEnv } from '../../env'
import { CustomerAccountService } from './application/customer-account-service'
import type { Clock, PremiumBonusGateway } from './application/ports'
import { CustomerAccountFailure } from './domain/errors'
import { createPrismaCustomerAccountRepository } from './infrastructure/customer-account-repository'
import { createPremiumBonusGateway } from './infrastructure/premiumbonus-client'
import { createCustomerSessionToken, hashCustomerSessionToken } from './infrastructure/session-tokens'
import { createCustomerAccountRoutes } from './transport/routes'

const systemClock: Clock = { now: () => new Date() }

export function createCustomerAccountModule({
  clock = systemClock,
  db,
  env,
  gateway = createConfiguredGateway(env),
}: {
  clock?: Clock
  db: DbClient
  env: AppEnv
  gateway?: PremiumBonusGateway
}) {
  const service = new CustomerAccountService({
    clock,
    gateway,
    repository: createPrismaCustomerAccountRepository(db),
    sessionTokens: {
      create: createCustomerSessionToken,
      hash: hashCustomerSessionToken,
    },
    sessionTtlDays: 7,
  })

  return {
    routes: createCustomerAccountRoutes({ env, service }),
    resolveCustomerId: (sessionToken: string | undefined) => service.resolveCustomerId(sessionToken),
  }
}

export { customerSessionCookieName } from './session-cookie'

function createConfiguredGateway(env: AppEnv): PremiumBonusGateway {
  if (!env.PREMIUMBONUS_API_TOKEN) {
    const unavailable = async (): Promise<never> => {
      throw new CustomerAccountFailure('loyalty_unavailable', 'Интеграция PremiumBonus не настроена')
    }
    return {
      getCustomer: unavailable,
      sendLoginCode: unavailable,
      verifyLoginCode: unavailable,
      generateOrderCode: unavailable,
    }
  }
  return createPremiumBonusGateway({
    apiToken: env.PREMIUMBONUS_API_TOKEN,
    baseUrl: env.PREMIUMBONUS_API_URL ?? 'https://site-v2.apipb.ru/',
  })
}

export type { PremiumBonusGateway } from './application/ports'
