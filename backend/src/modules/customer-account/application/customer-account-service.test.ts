import { describe, expect, mock, test } from 'bun:test'

import { CustomerAccountService } from './customer-account-service'
import type {
  CustomerAccountRepository,
  CustomerSessionTokens,
  LoyaltyCustomer,
  PremiumBonusGateway,
} from './ports'

const now = new Date('2026-08-02T07:00:00.000Z')
const customer: LoyaltyCustomer = {
  registered: true,
  blocked: false,
  clientId: 'pb-client-1',
  phone: '79131234567',
  name: 'Анна',
  surname: 'Иванова',
  middleName: null,
  email: null,
  cardNumber: '123456',
  balance: 725.5,
}

describe('CustomerAccountService', () => {
  test('sends a login code only to an existing unblocked loyalty customer', async () => {
    const repository = createRepository()
    const gateway = createGateway()
    const service = createService(repository, gateway)

    await expect(service.sendLoginCode('79131234567')).resolves.toEqual({
      challengeId: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      expiresAt: '2026-08-02T07:10:00.000Z',
    })
    expect(gateway.sendLoginCode).toHaveBeenCalledWith('79131234567')
    expect(repository.markLoginChallengeSent).toHaveBeenCalled()
  })

  test('does not send codes to unknown or blocked customers', async () => {
    const unknownGateway = createGateway({ ...customer, registered: false, clientId: null })
    await expect(createService(createRepository(), unknownGateway).sendLoginCode(customer.phone))
      .rejects.toMatchObject({ code: 'customer_not_registered' })
    expect(unknownGateway.sendLoginCode).not.toHaveBeenCalled()

    const blockedGateway = createGateway({ ...customer, blocked: true })
    await expect(createService(createRepository(), blockedGateway).sendLoginCode(customer.phone))
      .rejects.toMatchObject({ code: 'customer_blocked' })
    expect(blockedGateway.sendLoginCode).not.toHaveBeenCalled()
  })

  test('verifies the challenge once and creates a seven-day local session', async () => {
    const repository = createRepository()
    const gateway = createGateway()
    const service = createService(repository, gateway)

    await expect(service.verifyLoginCode({
      challengeId: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      code: '1234',
      metadata: { ipAddress: '127.0.0.1', userAgent: 'Bun test' },
    })).resolves.toMatchObject({
      customer: {
        phone: '79131234567',
        balance: 725.5,
      },
      sessionToken: 'customer-session-token',
      sessionExpiresAt: new Date('2026-08-09T07:00:00.000Z'),
    })

    expect(repository.completeLogin).toHaveBeenCalledWith(expect.objectContaining({
      challengeId: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      providerClientId: 'pb-client-1',
      sessionTokenHash: 'hashed-customer-session-token',
      sessionExpiresAt: new Date('2026-08-09T07:00:00.000Z'),
    }))
  })

  test('rejects expired and exhausted challenges before contacting PremiumBonus', async () => {
    const expiredRepository = createRepository()
    expiredRepository.findActiveLoginChallenge = mock(() => Promise.resolve(null))
    const expiredGateway = createGateway()
    await expect(createService(expiredRepository, expiredGateway).verifyLoginCode({
      challengeId: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      code: '1234',
      metadata: {},
    })).rejects.toMatchObject({ code: 'code_expired' })
    expect(expiredGateway.verifyLoginCode).not.toHaveBeenCalled()

    const exhaustedRepository = createRepository()
    exhaustedRepository.findActiveLoginChallenge = mock(() => Promise.resolve({
      id: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      phone: customer.phone,
      attemptCount: 5,
    }))
    const exhaustedGateway = createGateway()
    await expect(createService(exhaustedRepository, exhaustedGateway).verifyLoginCode({
      challengeId: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      code: '1234',
      metadata: {},
    })).rejects.toMatchObject({ code: 'too_many_attempts' })
    expect(exhaustedGateway.verifyLoginCode).not.toHaveBeenCalled()
  })

  test('refreshes the profile from PremiumBonus and generates a customer code for QR', async () => {
    const repository = createRepository()
    const gateway = createGateway()
    const service = createService(repository, gateway)

    await expect(service.getProfile('raw-session-token')).resolves.toMatchObject({
      id: '019fc12b-7054-70f1-9dc6-10bedb28192f',
      phone: customer.phone,
      balance: 725.5,
    })
    await expect(service.generateQrCode('raw-session-token')).resolves.toEqual({
      value: '481516',
      generatedAt: '2026-08-02T07:00:00.000Z',
    })
    expect(gateway.generateOrderCode).toHaveBeenCalledWith(customer.phone)
  })
})

function createService(repository: CustomerAccountRepository, gateway: PremiumBonusGateway) {
  const sessionTokens: CustomerSessionTokens = {
    create: () => 'customer-session-token',
    hash: (value) => `hashed-${value}`,
  }
  return new CustomerAccountService({
    clock: { now: () => now },
    gateway,
    repository,
    sessionTokens,
    sessionTtlDays: 7,
  })
}

function createGateway(profile: LoyaltyCustomer = customer): PremiumBonusGateway {
  return {
    getCustomer: mock(() => Promise.resolve(profile)),
    sendLoginCode: mock(() => Promise.resolve()),
    verifyLoginCode: mock(() => Promise.resolve()),
    generateOrderCode: mock(() => Promise.resolve('481516')),
  }
}

function createRepository(): CustomerAccountRepository {
  return {
    findRecentSentChallenge: mock(() => Promise.resolve(null)),
    createLoginChallenge: mock(() => Promise.resolve({ id: '019fc12b-7054-70f1-9dc6-10bedb28192e' })),
    markLoginChallengeSent: mock(() => Promise.resolve()),
    deleteLoginChallenge: mock(() => Promise.resolve()),
    findActiveLoginChallenge: mock(() => Promise.resolve({
      id: '019fc12b-7054-70f1-9dc6-10bedb28192e',
      phone: customer.phone,
      attemptCount: 0,
    })),
    incrementLoginAttempts: mock(() => Promise.resolve(1)),
    completeLogin: mock(() => Promise.resolve({ customerId: '019fc12b-7054-70f1-9dc6-10bedb28192f' })),
    findActiveSession: mock(() => Promise.resolve({
      sessionId: '019fc12b-7054-70f1-9dc6-10bedb281930',
      customer: {
        id: '019fc12b-7054-70f1-9dc6-10bedb28192f',
        providerClientId: customer.clientId!,
        phone: customer.phone,
      },
    })),
    revokeSession: mock(() => Promise.resolve()),
  }
}

