import { describe, expect, test } from 'bun:test'
import type { Order } from '@chashka-coffee/contracts'

import { PaymentService } from './payment-service'
import type {
  ClosingReceiptAttempt,
  OrderPaymentAttempt,
  OrderPaymentRepository,
  YooKassaGateway,
} from './payment-ports'

const orderId = '019fc12b-7054-70f1-9dc6-10bedb281931'
const paymentId = '2f66dbf0-000f-5000-9000-1d1234567890'
const attemptId = '019fc12b-7054-70f1-9dc6-10bedb281932'
const idempotencyKey = '019fc12b-7054-40f1-9dc6-10bedb281933'

describe('PaymentService', () => {
  test('starts one redirect payment and reuses the active attempt on retry', async () => {
    const repository = fakePaymentRepository()
    const gateway = fakeGateway()
    const service = createService(repository, gateway)

    const first = await service.start('private-token')
    const repeated = await service.start('private-token')

    expect(first.payment.confirmationUrl).toBe('https://yookassa.test/confirm')
    expect(repeated.payment.confirmationUrl).toBe(first.payment.confirmationUrl)
    expect(gateway.createdPayments).toHaveLength(1)
    expect(gateway.createdPayments[0]).toMatchObject({
      orderId,
      amountKopecks: 89_000,
      customerEmail: 'anna@example.com',
      items: [{
        description: 'Эфиопия Гуджи — 250 г',
        quantity: 1,
        amountKopecks: 89_000,
        vatCode: 1,
        paymentMode: 'full_prepayment',
        paymentSubject: 'commodity',
        measure: 'piece',
      }],
    })
  })

  test('returns an account customer to the protected order URL after payment', async () => {
    const repository = fakePaymentRepository()
    const gateway = fakeGateway()
    const service = createService(repository, gateway)

    await service.startCustomerOrder(sampleOrder())

    expect(gateway.createdPayments[0]?.returnUrl).toBe(`https://dev.chashkacoffee.ru/order?order=${orderId}&payment_return=1`)
  })

  test('trusts a succeeded webhook only after reading and matching the payment from YooKassa', async () => {
    const repository = fakePaymentRepository({ seededAttempt: pendingAttempt() })
    const gateway = fakeGateway({ paymentStatus: 'succeeded' })
    const notified: string[] = []
    const service = createService(repository, gateway, async (order) => { notified.push(order.id) })

    await service.handleNotification({ event: 'payment.succeeded', paymentId })
    await service.handleNotification({ event: 'payment.succeeded', paymentId })

    expect(gateway.readPayments).toEqual([paymentId, paymentId])
    expect(repository.succeeded).toHaveLength(1)
    expect(notified).toEqual([orderId])
  })

  test('rejects a webhook when YooKassa returns a different amount', async () => {
    const repository = fakePaymentRepository({ seededAttempt: pendingAttempt() })
    const gateway = fakeGateway({ paymentStatus: 'succeeded', paymentAmountKopecks: 1 })
    const service = createService(repository, gateway)

    await expect(service.handleNotification({ event: 'payment.succeeded', paymentId })).rejects.toThrow('amount')
    expect(repository.succeeded).toHaveLength(0)
  })

  test('creates the closing full-payment receipt before completing pickup', async () => {
    const repository = fakePaymentRepository({ seededAttempt: { ...pendingAttempt(), status: 'SUCCEEDED', activeOrderId: null } })
    const gateway = fakeGateway()
    const orders = fakeOrders({ status: 'READY_FOR_PICKUP', paymentStatus: 'PAID' })
    const service = createService(repository, gateway, undefined, orders)

    const completed = await service.complete(orderId)

    expect(completed.status).toBe('COMPLETED')
    expect(gateway.createdReceipts).toEqual([expect.objectContaining({
      paymentId,
      orderId,
      customerEmail: 'anna@example.com',
      settlementType: 'prepayment',
      items: [expect.objectContaining({ paymentMode: 'full_payment', vatCode: 1 })],
    })])
  })
})

function createService(
  repository: ReturnType<typeof fakePaymentRepository>,
  gateway: ReturnType<typeof fakeGateway>,
  onPaid?: (order: Order) => Promise<void>,
  orders = fakeOrders(),
) {
  return new PaymentService({
    orders,
    repository,
    gateway,
    expectedTestMode: true,
    returnUrl: 'https://dev.chashkacoffee.ru/order',
    idempotencyKey: () => idempotencyKey,
    onPaid,
  })
}

function fakeOrders(overrides: Partial<Order> = {}) {
  let order = sampleOrder(overrides)
  return {
    async getByAccessToken() { return order },
    async getById() { return order },
    async updateStatus(_id: string, status: Order['status']) {
      order = { ...order, status }
      return order
    },
  }
}

function fakePaymentRepository(options: { seededAttempt?: OrderPaymentAttempt } = {}) {
  let attempt = options.seededAttempt ?? null
  let receipt: ClosingReceiptAttempt | null = null
  const succeeded: string[] = []
  const repository: OrderPaymentRepository & { succeeded: string[] } = {
    succeeded,
    async findActiveByOrderId(id) { return attempt?.activeOrderId === id ? attempt : null },
    async createAttempt(input) {
      attempt = {
        id: attemptId,
        orderId: input.orderId,
        activeOrderId: input.orderId,
        providerPaymentId: null,
        idempotencyKey: input.idempotencyKey,
        status: 'CREATING',
        amountKopecks: input.amountKopecks,
        confirmationUrl: null,
      }
      return attempt
    },
    async savePending(input) {
      attempt = { ...attempt!, providerPaymentId: input.providerPaymentId, confirmationUrl: input.confirmationUrl, status: 'PENDING' }
      return attempt
    },
    async findByProviderPaymentId(id) { return attempt?.providerPaymentId === id ? attempt : null },
    async markSucceeded(id) {
      if (attempt?.providerPaymentId !== id) return null
      const changed = attempt.status !== 'SUCCEEDED'
      attempt = { ...attempt, status: 'SUCCEEDED', activeOrderId: null }
      if (changed) succeeded.push(id)
      return { order: sampleOrder({ status: 'PAID', paymentStatus: 'PAID' }), changed }
    },
    async markCanceled() {
      if (attempt) attempt = { ...attempt, status: 'CANCELED', activeOrderId: null }
    },
    async findSucceededByOrderId(id) { return attempt?.orderId === id && attempt.status === 'SUCCEEDED' ? attempt : null },
    async findClosingReceiptByOrderId(id) { return receipt?.orderId === id ? receipt : null },
    async createClosingReceiptAttempt(input) {
      receipt = { id: crypto.randomUUID(), orderId: input.orderId, paymentAttemptId: input.paymentAttemptId, providerReceiptId: null, idempotencyKey: input.idempotencyKey, status: 'CREATING' }
      return receipt
    },
    async saveClosingReceipt(input) {
      receipt = { ...receipt!, providerReceiptId: input.providerReceiptId, status: input.status }
      return receipt
    },
  }
  return repository
}

function fakeGateway(options: { paymentStatus?: 'pending' | 'succeeded' | 'canceled'; paymentAmountKopecks?: number } = {}) {
  const createdPayments: Array<Parameters<YooKassaGateway['createPayment']>[0]> = []
  const createdReceipts: Array<Parameters<YooKassaGateway['createClosingReceipt']>[0]> = []
  const readPayments: string[] = []
  return {
    createdPayments,
    createdReceipts,
    readPayments,
    async createPayment(input: Parameters<YooKassaGateway['createPayment']>[0]) {
      createdPayments.push(input)
      return providerPayment('pending')
    },
    async getPayment(id: string) {
      readPayments.push(id)
      return providerPayment(options.paymentStatus ?? 'pending', options.paymentAmountKopecks)
    },
    async createClosingReceipt(input: Parameters<YooKassaGateway['createClosingReceipt']>[0]) {
      createdReceipts.push(input)
      return { id: 'rt_test_receipt', status: 'pending' as const }
    },
  }
}

function providerPayment(status: 'pending' | 'succeeded' | 'canceled', amountKopecks = 89_000) {
  return {
    id: paymentId,
    status,
    amountKopecks,
    currency: 'RUB' as const,
    confirmationUrl: status === 'pending' ? 'https://yookassa.test/confirm' : null,
    metadataOrderId: orderId,
    test: true,
    receiptRegistration: status === 'succeeded' ? 'succeeded' : null,
  }
}

function pendingAttempt(): OrderPaymentAttempt {
  return {
    id: attemptId,
    orderId,
    activeOrderId: orderId,
    providerPaymentId: paymentId,
    idempotencyKey,
    status: 'PENDING',
    amountKopecks: 89_000,
    confirmationUrl: 'https://yookassa.test/confirm',
  }
}

function sampleOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: orderId,
    publicNumber: 'CK-260804-A1B2C3',
    status: 'AWAITING_PAYMENT',
    paymentStatus: 'PENDING',
    customer: { name: 'Анна', phone: '79131234567', email: 'anna@example.com' },
    pickupLocation: { id: null, slug: 'center', name: 'Центр', city: 'Новосибирск', address: 'Красный проспект, 25', phone: '+7 383 000-00-00', openingHoursLabel: 'Ежедневно' },
    items: [{ id: crypto.randomUUID(), variantId: null, productName: 'Эфиопия Гуджи', variantLabel: '250 г', imageUrl: null, unitPriceKopecks: 89_000, quantity: 1, totalKopecks: 89_000 }],
    itemCount: 1,
    totalKopecks: 89_000,
    comment: null,
    createdAt: '2026-08-04T10:00:00.000Z',
    updatedAt: '2026-08-04T10:00:00.000Z',
    ...overrides,
  }
}
