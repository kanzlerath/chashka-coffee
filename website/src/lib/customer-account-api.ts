import {
  apiErrorSchema,
  customerPhoneSchema,
  customerQrResponseSchema,
  customerSendCodeResponseSchema,
  customerSessionResponseSchema,
  type CustomerProfile,
} from '@chashka-coffee/contracts'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export class CustomerAccountApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

export function createCustomerAccountApi({
  apiOrigin = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000',
  fetch: fetchImplementation = (input, init) => fetch(input, init),
}: {
  apiOrigin?: string
  fetch?: FetchLike
} = {}) {
  let profileRequest: Promise<CustomerProfile | null> | null = null

  async function request(path: string, init?: RequestInit) {
    return fetchImplementation(`${apiOrigin}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    })
  }

  async function json<T>(response: Response, parse: (value: unknown) => T): Promise<T> {
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw customerApiError(response, payload)
    try {
      return parse(payload)
    } catch {
      throw new CustomerAccountApiError('INVALID_RESPONSE', 'Сервис вернул неожиданный ответ', 502)
    }
  }

  return {
    normalizePhone(value: string) {
      return customerPhoneSchema.parse(value)
    },

    getProfile(): Promise<CustomerProfile | null> {
      if (profileRequest) return profileRequest
      profileRequest = loadProfile().finally(() => { profileRequest = null })
      return profileRequest
    },

    async sendCode(phone: string) {
      const response = await request('/api/customer/auth/code', {
        method: 'POST',
        body: JSON.stringify({ phone: customerPhoneSchema.parse(phone) }),
      })
      return json(response, (value) => customerSendCodeResponseSchema.parse(value))
    },

    async verifyCode(challengeId: string, code: string) {
      const response = await request('/api/customer/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId, code }),
      })
      const result = await json(response, (value) => customerSessionResponseSchema.parse(value))
      return result.customer
    },

    async generateQr() {
      const response = await request('/api/customer/qr', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      return json(response, (value) => customerQrResponseSchema.parse(value))
    },

    async logout() {
      const response = await request('/api/customer/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw customerApiError(response, payload)
      }
    },
  }

  async function loadProfile(): Promise<CustomerProfile | null> {
    const response = await request('/api/customer/me')
    if (response.status === 401) return null
    const result = await json(response, (value) => customerSessionResponseSchema.parse(value))
    return result.customer
  }
}

function customerApiError(response: Response, payload: unknown) {
  const parsed = apiErrorSchema.safeParse(payload)
  if (parsed.success) {
    return new CustomerAccountApiError(
      parsed.data.error.code,
      parsed.data.error.message,
      response.status,
    )
  }
  return new CustomerAccountApiError(
    'REQUEST_FAILED',
    'Не удалось связаться с сервисом. Попробуйте ещё раз',
    response.status,
  )
}

export const customerAccountApi = createCustomerAccountApi()
