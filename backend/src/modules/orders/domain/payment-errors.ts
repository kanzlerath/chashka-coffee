export type PaymentFailureCode =
  | 'payment_not_configured'
  | 'payment_not_available'
  | 'payment_already_completed'
  | 'payment_verification_failed'
  | 'closing_receipt_required'

export class PaymentFailure extends Error {
  constructor(public readonly code: PaymentFailureCode, message: string, public readonly details?: unknown) {
    super(message)
  }
}
