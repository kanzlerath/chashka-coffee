export type AuthFailureKind =
  | 'access_token_invalid'
  | 'access_token_required'
  | 'email_already_exists'
  | 'invalid_credentials'
  | 'last_admin'
  | 'registration_closed'
  | 'refresh_session_invalid'
  | 'refresh_token_required'
  | 'session_invalid'
  | 'staff_not_found'
  | 'self_delete'

export class AuthFailure extends Error {
  constructor(
    public readonly kind: AuthFailureKind,
    message: string,
  ) {
    super(message)
  }
}
