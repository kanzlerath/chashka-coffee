import type { Order } from '@chashka-coffee/contracts'

import { OrderFailure } from '../domain/errors'
import { PaymentFailure } from '../domain/payment-errors'
import type {
  FiscalReceiptItem,
  OrderPaymentAttempt,
  OrderPaymentRepository,
  PaymentOrderService,
  YooKassaGateway,
  YooKassaPayment,
} from './payment-ports'

export class PaymentService {
  constructor(private readonly dependencies: {
    orders: PaymentOrderService
    repository: OrderPaymentRepository
    gateway: YooKassaGateway
    expectedTestMode: boolean
    returnUrl: string
    idempotencyKey: () => string
    onPaid?: (order: Order) => Promise<void>
  }) {}

  async start(accessToken: string) {
    const order = await this.dependencies.orders.getByAccessToken(accessToken)
    if (order.status !== 'AWAITING_PAYMENT' || order.paymentStatus === 'PAID') {
      throw new PaymentFailure('payment_already_completed', 'Этот заказ уже оплачен или закрыт.')
    }
    const email = requireReceiptEmail(order)
    let attempt = await this.dependencies.repository.findActiveByOrderId(order.id)
    if (attempt?.status === 'PENDING' && attempt.confirmationUrl) {
      return paymentResult(order, attempt.confirmationUrl)
    }
    attempt ??= await this.dependencies.repository.createAttempt({
      orderId: order.id,
      amountKopecks: order.totalKopecks,
      idempotencyKey: this.dependencies.idempotencyKey(),
    })

    const payment = await this.dependencies.gateway.createPayment({
      orderId: order.id,
      publicNumber: order.publicNumber,
      amountKopecks: order.totalKopecks,
      returnUrl: buildReturnUrl(this.dependencies.returnUrl, accessToken),
      customerEmail: email,
      items: receiptItems(order, 'full_prepayment'),
    }, attempt.idempotencyKey)
    assertCreatedPayment(payment, order, this.dependencies.expectedTestMode)
    const saved = await this.dependencies.repository.savePending({
      attemptId: attempt.id,
      providerPaymentId: payment.id,
      confirmationUrl: payment.confirmationUrl!,
    })
    return paymentResult(order, saved.confirmationUrl!)
  }

  async handleNotification(notification: { event: 'payment.succeeded' | 'payment.canceled'; paymentId: string }) {
    const attempt = await this.dependencies.repository.findByProviderPaymentId(notification.paymentId)
    if (!attempt) return

    const payment = await this.dependencies.gateway.getPayment(notification.paymentId)
    assertVerifiedPayment(payment, attempt, this.dependencies.expectedTestMode)
    if (payment.status === 'pending') {
      throw new PaymentFailure('payment_verification_failed', 'YooKassa payment status is still pending.')
    }
    if (payment.status === 'canceled') {
      await this.dependencies.repository.markCanceled(payment.id)
      return
    }

    const result = await this.dependencies.repository.markSucceeded(payment.id, payment.receiptRegistration)
    if (result?.changed) {
      try {
        await this.dependencies.onPaid?.(result.order)
      } catch {
        // Payment state is authoritative; an operational notification can be retried independently.
      }
    }
  }

  async complete(orderId: string) {
    const order = await this.dependencies.orders.getById(orderId)
    if (order.status === 'COMPLETED') return order
    if (order.status !== 'READY_FOR_PICKUP' || order.paymentStatus !== 'PAID') {
      throw new OrderFailure('invalid_status_transition', 'К выдаче можно завершить только оплаченный готовый заказ.')
    }
    const email = requireReceiptEmail(order)
    const payment = await this.dependencies.repository.findSucceededByOrderId(order.id)
    if (!payment?.providerPaymentId) {
      throw new PaymentFailure('closing_receipt_required', 'Для заказа не найден подтверждённый платёж ЮKassa.')
    }
    let receipt = await this.dependencies.repository.findClosingReceiptByOrderId(order.id)
    receipt ??= await this.dependencies.repository.createClosingReceiptAttempt({
      orderId: order.id,
      paymentAttemptId: payment.id,
      idempotencyKey: this.dependencies.idempotencyKey(),
    })
    if (receipt.status === 'CANCELED') {
      throw new PaymentFailure('closing_receipt_required', 'Закрывающий чек ЮKassa не зарегистрирован.')
    }
    if (!receipt.providerReceiptId) {
      const providerReceipt = await this.dependencies.gateway.createClosingReceipt({
        orderId: order.id,
        paymentId: payment.providerPaymentId,
        customerEmail: email,
        amountKopecks: order.totalKopecks,
        settlementType: 'prepayment',
        items: receiptItems(order, 'full_payment'),
      }, receipt.idempotencyKey)
      await this.dependencies.repository.saveClosingReceipt({
        receiptAttemptId: receipt.id,
        providerReceiptId: providerReceipt.id,
        status: providerReceipt.status.toUpperCase() as 'PENDING' | 'SUCCEEDED' | 'CANCELED',
      })
      if (providerReceipt.status === 'canceled') {
        throw new PaymentFailure('closing_receipt_required', 'ЮKassa отклонила закрывающий чек.')
      }
    }
    return this.dependencies.orders.updateStatus(order.id, 'COMPLETED')
  }
}

function receiptItems(order: Order, paymentMode: FiscalReceiptItem['paymentMode']): FiscalReceiptItem[] {
  return order.items.map((item) => ({
    description: `${item.productName} — ${item.variantLabel}`.slice(0, 128),
    quantity: item.quantity,
    amountKopecks: item.unitPriceKopecks,
    vatCode: 1,
    paymentMode,
    paymentSubject: 'commodity',
    measure: 'piece',
  }))
}

function requireReceiptEmail(order: Order) {
  if (!order.customer.email) {
    throw new PaymentFailure('payment_not_available', 'Для отправки фискального чека нужен e-mail покупателя.')
  }
  return order.customer.email
}

function buildReturnUrl(baseUrl: string, accessToken: string) {
  const url = new URL(baseUrl)
  url.searchParams.set('token', accessToken)
  url.searchParams.set('payment_return', '1')
  return url.toString()
}

function assertCreatedPayment(payment: YooKassaPayment, order: Order, expectedTestMode: boolean) {
  assertPaymentIdentity(payment, order.id, order.totalKopecks, expectedTestMode)
  if (payment.status !== 'pending' || !payment.confirmationUrl) {
    throw new PaymentFailure('payment_verification_failed', 'YooKassa did not return a pending redirect payment.')
  }
}

function assertVerifiedPayment(payment: YooKassaPayment, attempt: OrderPaymentAttempt, expectedTestMode: boolean) {
  if (payment.id !== attempt.providerPaymentId) {
    throw new PaymentFailure('payment_verification_failed', 'YooKassa payment id does not match the stored attempt.')
  }
  assertPaymentIdentity(payment, attempt.orderId, attempt.amountKopecks, expectedTestMode)
}

function assertPaymentIdentity(payment: YooKassaPayment, orderId: string, amountKopecks: number, expectedTestMode: boolean) {
  if (payment.amountKopecks !== amountKopecks) {
    throw new PaymentFailure('payment_verification_failed', 'YooKassa payment amount does not match the order.')
  }
  if (payment.currency !== 'RUB' || payment.metadataOrderId !== orderId || payment.test !== expectedTestMode) {
    throw new PaymentFailure('payment_verification_failed', 'YooKassa payment identity does not match the order.')
  }
}

function paymentResult(order: Order, confirmationUrl: string) {
  return { order, payment: { status: 'PENDING' as const, confirmationUrl } }
}
