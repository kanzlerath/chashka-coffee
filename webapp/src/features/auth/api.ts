import {
  cookieAuthResponseSchema,
  cookieLogoutRequestSchema,
  cookieRefreshRequestSchema,
  cookieRefreshResponseSchema,
  loginRequestSchema,
  meResponseSchema,
  type CookieAuthResponse,
  type CookieRefreshResponse,
  type LoginRequest,
  type MeResponse,
} from '@chashka-coffee/contracts'
import type { z } from 'zod'
import { ApiRequestError, HttpClient } from '@/platform/api'

type AuthApiOptions = {
  getAccessToken: () => string | null
  setAccessToken: (accessToken: string | null) => void
  onAuthExpired?: () => void | Promise<void>
}

export class AuthApi {
  private readonly options: AuthApiOptions
  private readonly http: HttpClient
  private refreshPromise: Promise<CookieRefreshResponse> | null = null

  constructor(options: AuthApiOptions, http = new HttpClient()) {
    this.options = options
    this.http = http
  }

  login(input: LoginRequest): Promise<CookieAuthResponse> {
    const payload = loginRequestSchema.parse(input)
    return this.http.request('/api/auth/login', cookieAuthResponseSchema, {
      method: 'POST',
      body: payload,
    })
  }

  refresh(): Promise<CookieRefreshResponse> {
    const payload = cookieRefreshRequestSchema.parse({})
    return this.http.request('/api/auth/refresh', cookieRefreshResponseSchema, {
      method: 'POST',
      body: payload,
    })
  }

  me(): Promise<MeResponse> {
    return this.authenticatedRequest('/api/auth/me', meResponseSchema)
  }

  async logout() {
    const payload = cookieLogoutRequestSchema.parse({})
    await this.http.raw('/api/auth/logout', {
      method: 'POST',
      body: payload,
    })
  }

  async expireSession() {
    this.options.setAccessToken(null)
    await this.http.raw('/api/auth/logout', {
      method: 'POST',
      body: {},
    }).catch(() => undefined)
    await this.options.onAuthExpired?.()
  }

  request<TSchema extends z.ZodType>(path: string, schema: TSchema, options: Parameters<HttpClient['request']>[2] = {}) {
    return this.authenticatedRequest(path, schema, undefined, options)
  }

  private async authenticatedRequest<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    accessTokenOverride?: string,
    options: Parameters<HttpClient['request']>[2] = {},
  ): Promise<z.infer<TSchema>> {
    const accessToken = accessTokenOverride ?? this.options.getAccessToken()
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined

    try {
      return await this.http.request(path, schema, { ...options, headers: { ...options.headers, ...headers } })
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.status !== 401 || accessTokenOverride) {
        throw error
      }

      const refreshed = await this.refreshOnce().catch(async (refreshError: unknown) => {
        await this.expireSession()
        throw refreshError
      })
      this.options.setAccessToken(refreshed.accessToken)
      return this.authenticatedRequest(path, schema, refreshed.accessToken, options)
    }
  }

  private refreshOnce() {
    this.refreshPromise ??= this.refresh().finally(() => {
      this.refreshPromise = null
    })

    return this.refreshPromise
  }
}
