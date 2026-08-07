import type { Order } from '@chashka-coffee/contracts'

export type FiscalReceiptItem = {
  description: string
  quantity: number
  amountKopecks: number
  vatCode: 1
  paymentMode: 'full_prepayment' | 'full_payment'
  paymentSubject: 'commodity'
  measure: 'piece'
}

export type CreateYooKassaPayment = {
  orderId: string
  publicNumber: string
  amountKopecks: number
  returnUrl: string
  customerEmail: string
  items: FiscalReceiptItem[]
}

export type CreateYooKassaClosingReceipt = {
  orderId: string
  paymentId: string
  customerEmail: string
  amountKopecks: number
  settlementType: 'prepayment'
  items: FiscalReceiptItem[]
}

export type YooKassaPayment = {
  id: string
  status: 'pending' | 'succeeded' | 'canceled'
  amountKopecks: number
  currency: 'RUB'
  confirmationUrl: string | null
  metadataOrderId: string | null
  test: boolean
  receiptRegistration: string | null
}

export type YooKassaGateway = {
  createPayment(input: CreateYooKassaPayment, idempotencyKey: string): Promise<YooKassaPayment>
  getPayment(id: string): Promise<YooKassaPayment>
  createClosingReceipt(
    input: CreateYooKassaClosingReceipt,
    idempotencyKey: string,
  ): Promise<{ id: string; status: 'pending' | 'succeeded' | 'canceled' }>
}

export type OrderPaymentAttempt = {
  id: string
  orderId: string
  activeOrderId: string | null
  providerPaymentId: string | null
  idempotencyKey: string
  status: 'CREATING' | 'PENDING' | 'SUCCEEDED' | 'CANCELED'
  amountKopecks: number
  confirmationUrl: string | null
}

export type ClosingReceiptAttempt = {
  id: string
  orderId: string
  paymentAttemptId: string
  providerReceiptId: string | null
  idempotencyKey: string
  status: 'CREATING' | 'PENDING' | 'SUCCEEDED' | 'CANCELED'
}

export type OrderPaymentRepository = {
  findActiveByOrderId(orderId: string): Promise<OrderPaymentAttempt | null>
  createAttempt(input: { orderId: string; amountKopecks: number; idempotencyKey: string }): Promise<OrderPaymentAttempt>
  savePending(input: { attemptId: string; providerPaymentId: string; confirmationUrl: string }): Promise<OrderPaymentAttempt>
  findByProviderPaymentId(providerPaymentId: string): Promise<OrderPaymentAttempt | null>
  markSucceeded(providerPaymentId: string, receiptRegistration: string | null): Promise<{ order: Order; changed: boolean } | null>
  markCanceled(providerPaymentId: string): Promise<void>
  findSucceededByOrderId(orderId: string): Promise<OrderPaymentAttempt | null>
  findClosingReceiptByOrderId(orderId: string): Promise<ClosingReceiptAttempt | null>
  createClosingReceiptAttempt(input: { orderId: string; paymentAttemptId: string; idempotencyKey: string }): Promise<ClosingReceiptAttempt>
  saveClosingReceipt(input: { receiptAttemptId: string; providerReceiptId: string; status: 'PENDING' | 'SUCCEEDED' | 'CANCELED' }): Promise<ClosingReceiptAttempt>
}

export type PaymentOrderService = {
  getByAccessToken(accessToken: string): Promise<Order>
  getById(id: string): Promise<Order>
  updateStatus(id: string, status: Order['status']): Promise<Order>
}
