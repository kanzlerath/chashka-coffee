export type OrderFailureCode =
  | 'cart_unavailable'
  | 'pickup_unavailable'
  | 'order_not_found'
  | 'invalid_status_transition'

export class OrderFailure extends Error {
  constructor(public readonly code: OrderFailureCode, message: string, public readonly details?: unknown) {
    super(message)
  }
}
