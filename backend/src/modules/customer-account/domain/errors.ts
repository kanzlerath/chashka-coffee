export type CustomerAccountFailureCode =
  | 'customer_blocked'
  | 'customer_not_registered'
  | 'code_expired'
  | 'code_invalid'
  | 'loyalty_unavailable'
  | 'session_invalid'
  | 'too_many_attempts'
  | 'too_many_requests'

export class CustomerAccountFailure extends Error {
  constructor(
    public readonly code: CustomerAccountFailureCode,
    message: string,
  ) {
    super(message)
  }
}

