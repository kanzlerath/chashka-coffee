import type { CustomerProfile, CustomerQrResponse, CustomerSendCodeResponse } from '@chashka-coffee/contracts'

import { CustomerAccountFailure } from '../domain/errors'
import type {
  Clock,
  CustomerAccountRepository,
  CustomerSessionMetadata,
  CustomerSessionTokens,
  LoyaltyCustomer,
  PremiumBonusGateway,
} from './ports'
import { toCustomerProfile } from './ports'

const challengeTtlMs = 10 * 60 * 1000
const resendWindowMs = 60 * 1000
const maxCodeAttempts = 5

type CustomerAccountServiceDependencies = {
  clock: Clock
  gateway: PremiumBonusGateway
  repository: CustomerAccountRepository
  sessionTokens: CustomerSessionTokens
  sessionTtlDays: number
}

export class CustomerAccountService {
  constructor(private readonly dependencies: CustomerAccountServiceDependencies) {}

  async sendLoginCode(phone: string): Promise<CustomerSendCodeResponse> {
    const now = this.dependencies.clock.now()
    const recentChallenge = await this.dependencies.repository.findRecentSentChallenge({
      phone,
      sentAfter: new Date(now.getTime() - resendWindowMs),
    })
    if (recentChallenge) {
      throw new CustomerAccountFailure('too_many_requests', 'Повторный код можно запросить через минуту')
    }

    const customer = await this.dependencies.gateway.getCustomer(phone)
    this.assertCustomerCanLogin(customer)

    const expiresAt = new Date(now.getTime() + challengeTtlMs)
    const challenge = await this.dependencies.repository.createLoginChallenge({ phone, expiresAt, now })
    try {
      await this.dependencies.gateway.sendLoginCode(phone)
      await this.dependencies.repository.markLoginChallengeSent({ id: challenge.id, sentAt: now })
    } catch (error) {
      await this.dependencies.repository.deleteLoginChallenge(challenge.id)
      throw error
    }

    return {
      challengeId: challenge.id,
      expiresAt: expiresAt.toISOString(),
    }
  }

  async verifyLoginCode(input: {
    challengeId: string
    code: string
    metadata: CustomerSessionMetadata
  }): Promise<{
    customer: CustomerProfile
    sessionToken: string
    sessionExpiresAt: Date
  }> {
    const now = this.dependencies.clock.now()
    const challenge = await this.dependencies.repository.findActiveLoginChallenge({
      id: input.challengeId,
      now,
    })
    if (!challenge) {
      throw new CustomerAccountFailure('code_expired', 'Код истёк. Запросите новый')
    }
    if (challenge.attemptCount >= maxCodeAttempts) {
      throw new CustomerAccountFailure('too_many_attempts', 'Слишком много попыток. Запросите новый код')
    }

    const attemptCount = await this.dependencies.repository.incrementLoginAttempts(challenge.id)
    if (attemptCount > maxCodeAttempts) {
      throw new CustomerAccountFailure('too_many_attempts', 'Слишком много попыток. Запросите новый код')
    }

    await this.dependencies.gateway.verifyLoginCode(challenge.phone, input.code)
    const loyaltyCustomer = await this.dependencies.gateway.getCustomer(challenge.phone)
    this.assertCustomerCanLogin(loyaltyCustomer)
    if (!loyaltyCustomer.clientId) {
      throw new CustomerAccountFailure('loyalty_unavailable', 'PremiumBonus не вернул идентификатор клиента')
    }

    const sessionToken = this.dependencies.sessionTokens.create()
    const sessionExpiresAt = new Date(
      now.getTime() + this.dependencies.sessionTtlDays * 24 * 60 * 60 * 1000,
    )
    const completed = await this.dependencies.repository.completeLogin({
      challengeId: challenge.id,
      phone: loyaltyCustomer.phone,
      providerClientId: loyaltyCustomer.clientId,
      sessionTokenHash: this.dependencies.sessionTokens.hash(sessionToken),
      sessionExpiresAt,
      now,
      metadata: input.metadata,
    })
    if (!completed) {
      throw new CustomerAccountFailure('code_expired', 'Код уже использован. Запросите новый')
    }

    return {
      customer: toCustomerProfile(completed.customerId, loyaltyCustomer),
      sessionToken,
      sessionExpiresAt,
    }
  }

  async getProfile(sessionToken: string | undefined): Promise<CustomerProfile> {
    const session = await this.authenticateSession(sessionToken)
    const customer = await this.dependencies.gateway.getCustomer(session.customer.phone)
    this.assertCustomerCanLogin(customer)
    return toCustomerProfile(session.customer.id, customer)
  }

  async generateQrCode(sessionToken: string | undefined): Promise<CustomerQrResponse> {
    const session = await this.authenticateSession(sessionToken)
    const customer = await this.dependencies.gateway.getCustomer(session.customer.phone)
    this.assertCustomerCanLogin(customer)
    return {
      value: await this.dependencies.gateway.generateOrderCode(customer.phone),
      generatedAt: this.dependencies.clock.now().toISOString(),
    }
  }

  async logout(sessionToken: string | undefined) {
    if (!sessionToken) return
    await this.dependencies.repository.revokeSession({
      tokenHash: this.dependencies.sessionTokens.hash(sessionToken),
      now: this.dependencies.clock.now(),
    })
  }

  private async authenticateSession(sessionToken: string | undefined) {
    if (!sessionToken) {
      throw new CustomerAccountFailure('session_invalid', 'Войдите в аккаунт')
    }
    const session = await this.dependencies.repository.findActiveSession({
      tokenHash: this.dependencies.sessionTokens.hash(sessionToken),
      now: this.dependencies.clock.now(),
    })
    if (!session) {
      throw new CustomerAccountFailure('session_invalid', 'Сессия истекла. Войдите снова')
    }
    return session
  }

  private assertCustomerCanLogin(customer: LoyaltyCustomer) {
    if (!customer.registered) {
      throw new CustomerAccountFailure(
        'customer_not_registered',
        'Этот номер пока не участвует в программе лояльности',
      )
    }
    if (customer.blocked) {
      throw new CustomerAccountFailure(
        'customer_blocked',
        'Доступ к программе лояльности ограничен. Обратитесь в поддержку',
      )
    }
  }
}

