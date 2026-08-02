import type { CustomerProfile } from '@chashka-coffee/contracts'

export type LoyaltyCustomer = {
  registered: boolean
  blocked: boolean
  clientId: string | null
  phone: string
  name: string | null
  surname: string | null
  middleName: string | null
  email: string | null
  cardNumber: string | null
  balance: number
}

export type PremiumBonusGateway = {
  getCustomer(phone: string): Promise<LoyaltyCustomer>
  sendLoginCode(phone: string): Promise<void>
  verifyLoginCode(phone: string, code: string): Promise<void>
  generateOrderCode(phone: string): Promise<string>
}

export type CustomerSessionMetadata = {
  ipAddress?: string
  userAgent?: string
}

export type CustomerRecord = {
  id: string
  providerClientId: string
  phone: string
}

export type CustomerAccountRepository = {
  findRecentSentChallenge(input: { phone: string; sentAfter: Date }): Promise<{ id: string } | null>
  createLoginChallenge(input: { phone: string; expiresAt: Date; now: Date }): Promise<{ id: string }>
  markLoginChallengeSent(input: { id: string; sentAt: Date }): Promise<void>
  deleteLoginChallenge(id: string): Promise<void>
  findActiveLoginChallenge(input: { id: string; now: Date }): Promise<{
    id: string
    phone: string
    attemptCount: number
  } | null>
  incrementLoginAttempts(id: string): Promise<number>
  completeLogin(input: {
    challengeId: string
    phone: string
    providerClientId: string
    sessionTokenHash: string
    sessionExpiresAt: Date
    now: Date
    metadata: CustomerSessionMetadata
  }): Promise<{ customerId: string } | null>
  findActiveSession(input: { tokenHash: string; now: Date }): Promise<{
    sessionId: string
    customer: CustomerRecord
  } | null>
  revokeSession(input: { tokenHash: string; now: Date }): Promise<void>
}

export type CustomerSessionTokens = {
  create(): string
  hash(token: string): string
}

export type Clock = {
  now(): Date
}

export function toCustomerProfile(id: string, customer: LoyaltyCustomer): CustomerProfile {
  return {
    id,
    phone: customer.phone,
    name: customer.name,
    surname: customer.surname,
    middleName: customer.middleName,
    email: customer.email,
    cardNumber: customer.cardNumber,
    balance: customer.balance,
  }
}

