import type { DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import type {
  ClosingReceiptAttempt,
  OrderPaymentAttempt,
  OrderPaymentRepository,
} from '../application/payment-ports'
import { PaymentFailure } from '../domain/payment-errors'
import { includeOrderItems, toOrder, type OrderRecord } from './order-repository'

type PaymentRecord = {
  id: string
  orderId: string
  activeOrderId: string | null
  providerPaymentId: string | null
  idempotencyKey: string
  status: OrderPaymentAttempt['status']
  amountKopecks: number
  confirmationUrl: string | null
}

type ReceiptRecord = {
  id: string
  orderId: string
  paymentAttemptId: string
  providerReceiptId: string | null
  idempotencyKey: string
  status: ClosingReceiptAttempt['status']
}

export function createPrismaOrderPaymentRepository(db: DbClient): OrderPaymentRepository {
  return {
    async findActiveByOrderId(orderId) {
      return mapPayment(await db.orderPayment.findUnique({ where: { activeOrderId: orderId } }))
    },

    async createAttempt(input) {
      try {
        return mapPayment(await db.$transaction(async (tx) => {
          const payment = await tx.orderPayment.create({
            data: {
              orderId: input.orderId,
              activeOrderId: input.orderId,
              idempotencyKey: input.idempotencyKey,
              amountKopecks: input.amountKopecks,
            },
          })
          await tx.order.update({ where: { id: input.orderId }, data: { paymentStatus: 'PENDING' } })
          return payment
        }))!
      } catch (error) {
        if (isUniqueConflict(error)) {
          const existing = await db.orderPayment.findUnique({ where: { activeOrderId: input.orderId } })
          if (existing) return mapPayment(existing)!
        }
        throw error
      }
    },

    async savePending(input) {
      return mapPayment(await db.orderPayment.update({
        where: { id: input.attemptId },
        data: {
          providerPaymentId: input.providerPaymentId,
          confirmationUrl: input.confirmationUrl,
          status: 'PENDING',
        },
      }))!
    },

    async findByProviderPaymentId(providerPaymentId) {
      return mapPayment(await db.orderPayment.findUnique({ where: { providerPaymentId } }))
    },

    async markSucceeded(providerPaymentId, receiptRegistration) {
      return db.$transaction(async (tx) => {
        const payment = await tx.orderPayment.findUnique({ where: { providerPaymentId } })
        if (!payment) return null
        if (payment.status === 'SUCCEEDED') {
          const order = await tx.order.findUnique({ where: { id: payment.orderId }, include: includeOrderItems })
          return order ? { order: toOrder(order as OrderRecord), changed: false } : null
        }
        const transitioned = await tx.order.updateMany({
          where: { id: payment.orderId, status: 'AWAITING_PAYMENT', paymentStatus: { not: 'PAID' } },
          data: { status: 'PAID', paymentStatus: 'PAID' },
        })
        if (transitioned.count !== 1) {
          throw new PaymentFailure('payment_verification_failed', 'Paid YooKassa payment cannot transition the current order.')
        }
        await tx.orderPayment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCEEDED',
            activeOrderId: null,
            receiptRegistration,
          },
        })
        const order = await tx.order.findUnique({ where: { id: payment.orderId }, include: includeOrderItems })
        return order ? { order: toOrder(order as OrderRecord), changed: true } : null
      })
    },

    async markCanceled(providerPaymentId) {
      await db.$transaction(async (tx) => {
        const payment = await tx.orderPayment.findUnique({ where: { providerPaymentId } })
        if (!payment || payment.status === 'SUCCEEDED') return
        await tx.orderPayment.update({
          where: { id: payment.id },
          data: { status: 'CANCELED', activeOrderId: null },
        })
        await tx.order.updateMany({
          where: { id: payment.orderId, status: 'AWAITING_PAYMENT' },
          data: { paymentStatus: 'FAILED' },
        })
      })
    },

    async findSucceededByOrderId(orderId) {
      return mapPayment(await db.orderPayment.findFirst({
        where: { orderId, status: 'SUCCEEDED' },
        orderBy: { createdAt: 'desc' },
      }))
    },

    async findClosingReceiptByOrderId(orderId) {
      return mapReceipt(await db.orderClosingReceipt.findUnique({ where: { orderId } }))
    },

    async createClosingReceiptAttempt(input) {
      try {
        return mapReceipt(await db.orderClosingReceipt.create({
          data: {
            orderId: input.orderId,
            paymentAttemptId: input.paymentAttemptId,
            idempotencyKey: input.idempotencyKey,
          },
        }))!
      } catch (error) {
        if (isUniqueConflict(error)) {
          const existing = await db.orderClosingReceipt.findUnique({ where: { orderId: input.orderId } })
          if (existing) return mapReceipt(existing)!
        }
        throw error
      }
    },

    async saveClosingReceipt(input) {
      return mapReceipt(await db.orderClosingReceipt.update({
        where: { id: input.receiptAttemptId },
        data: { providerReceiptId: input.providerReceiptId, status: input.status },
      }))!
    },
  }
}

function mapPayment(record: PaymentRecord | null): OrderPaymentAttempt | null {
  if (!record) return null
  return {
    id: record.id,
    orderId: record.orderId,
    activeOrderId: record.activeOrderId,
    providerPaymentId: record.providerPaymentId,
    idempotencyKey: record.idempotencyKey,
    status: record.status,
    amountKopecks: record.amountKopecks,
    confirmationUrl: record.confirmationUrl,
  }
}

function mapReceipt(record: ReceiptRecord | null): ClosingReceiptAttempt | null {
  if (!record) return null
  return {
    id: record.id,
    orderId: record.orderId,
    paymentAttemptId: record.paymentAttemptId,
    providerReceiptId: record.providerReceiptId,
    idempotencyKey: record.idempotencyKey,
    status: record.status,
  }
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}
