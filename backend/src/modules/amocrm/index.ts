import type { AppEnv } from '../../env'

type LeadInput = {
  id: string
  name: string
  phone: string | null
  email: string | null
  message: string | null
  metadata: Record<string, string> | null
}

type AmoTokenResponse = { access_token: string; refresh_token?: string; expires_in: number }
export type AmoCrmClient = ReturnType<typeof createAmoCrmClient>

const text = (value: string | undefined) => value?.trim() || undefined

export function createAmoCrmClient(env: AppEnv) {
  const configured = Boolean(env.AMOCRM_SUBDOMAIN && (env.AMOCRM_ACCESS_TOKEN || (env.AMOCRM_CLIENT_ID && env.AMOCRM_CLIENT_SECRET)))
  let accessToken = env.AMOCRM_ACCESS_TOKEN
  let expiresAt = env.AMOCRM_TOKEN_EXPIRES_AT ?? 0

  async function refreshTokenIfNeeded() {
    if (accessToken && expiresAt > Date.now() + 60_000) return accessToken
    if (!env.AMOCRM_SUBDOMAIN || !env.AMOCRM_CLIENT_ID || !env.AMOCRM_CLIENT_SECRET || !env.AMOCRM_REFRESH_TOKEN || !env.AMOCRM_REDIRECT_URI) return accessToken
    const response = await fetch(`https://${env.AMOCRM_SUBDOMAIN}.amocrm.ru/oauth2/access_token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.AMOCRM_CLIENT_ID, client_secret: env.AMOCRM_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: env.AMOCRM_REFRESH_TOKEN, redirect_uri: env.AMOCRM_REDIRECT_URI }),
    })
    if (!response.ok) throw new Error(`amoCRM token refresh failed (${response.status})`)
    const token = await response.json() as AmoTokenResponse
    accessToken = token.access_token
    expiresAt = Date.now() + token.expires_in * 1000
    return accessToken
  }

  async function request(path: string, init: RequestInit = {}) {
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = await refreshTokenIfNeeded()
      if (!token || !env.AMOCRM_SUBDOMAIN) throw new Error('amoCRM is not configured')
      const response = await fetch(`https://${env.AMOCRM_SUBDOMAIN}.amocrm.ru${path}`, {
        ...init, headers: { Accept: 'application/hal+json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
      })
      if (response.ok) return response.json() as Promise<Record<string, unknown>>
      const detail = (await response.text()).slice(0, 500)
      lastError = new Error(`amoCRM API failed (${response.status}): ${detail}`)
      if (response.status < 429 && response.status < 500) break
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
    }
    throw lastError ?? new Error('amoCRM API request failed')
  }

  function field(fieldId: number | undefined, value: string | undefined) {
    return fieldId && text(value) ? { field_id: fieldId, values: [{ value: text(value) }] } : null
  }

  async function createFranchiseLead(lead: LeadInput) {
    if (!configured || lead.metadata?.source !== 'franchise-page') return null
    const metadata = lead.metadata ?? {}
    const customFields = [
      field(env.AMOCRM_SOURCE_FIELD_ID, `${metadata.attribution_source ?? 'Источник не определён'} · Франшиза`),
      field(env.AMOCRM_UTM_SOURCE_FIELD_ID, metadata.utm_source),
      field(env.AMOCRM_UTM_MEDIUM_FIELD_ID, metadata.utm_medium),
      field(env.AMOCRM_UTM_CAMPAIGN_FIELD_ID, metadata.utm_campaign),
      field(env.AMOCRM_UTM_CONTENT_FIELD_ID, metadata.utm_content),
      field(env.AMOCRM_UTM_TERM_FIELD_ID, metadata.utm_term),
      field(env.AMOCRM_REFERRER_FIELD_ID, metadata.referrer),
    ].filter(Boolean)
    const contact: Record<string, unknown> = { name: lead.name, request_id: `lead-${lead.id}` }
    const contactFields = [lead.phone ? { field_code: 'PHONE', values: [{ value: lead.phone, enum_code: 'WORK' }] } : null, lead.email ? { field_code: 'EMAIL', values: [{ value: lead.email, enum_code: 'WORK' }] } : null].filter(Boolean)
    if (contactFields.length) contact.custom_fields_values = contactFields
    let pipelineId = env.AMOCRM_PIPELINE_ID
    let statusId = env.AMOCRM_STATUS_ID
    if (!pipelineId || !statusId) {
      const pipelines = await request('/api/v4/leads/pipelines?with=statuses')
      const entries = (pipelines._embedded as { pipelines?: Array<{ id?: number; name?: string; _embedded?: { statuses?: Array<{ id?: number; name?: string }> } }> } | undefined)?.pipelines ?? []
      const pipelineName = env.AMOCRM_PIPELINE_NAME ?? 'Воронка продаж'
      const statusName = env.AMOCRM_STATUS_NAME ?? 'Входящий лид'
      const pipeline = entries.find((item) => item.name === pipelineName)
      pipelineId ??= pipeline?.id
      statusId ??= pipeline?._embedded?.statuses?.find((item) => item.name === statusName)?.id
      if (!pipelineId || !statusId) throw new Error(`amoCRM pipeline or status not found: ${pipelineName} / ${statusName}`)
    }
    const deal: Record<string, unknown> = { name: `Франшиза · ${lead.metadata?.subject ?? lead.name}`, request_id: `lead-${lead.id}`, ...(pipelineId ? { pipeline_id: pipelineId } : {}), ...(statusId ? { status_id: statusId } : {}) }
    if (customFields.length) deal.custom_fields_values = customFields
    const result = await request('/api/v4/leads/complex', { method: 'POST', body: JSON.stringify([{ ...deal, _embedded: { contacts: [contact] } }]) })
    const created = (result._embedded as { leads?: Array<{ id?: number }> } | undefined)?.leads?.[0]
    if (created?.id) {
      const attributionLines = [
        `Источник: ${metadata.attribution_source ?? 'не определён'}`,
        metadata.utm_source && `UTM source: ${metadata.utm_source}`,
        metadata.utm_medium && `UTM medium: ${metadata.utm_medium}`,
        metadata.utm_campaign && `UTM campaign: ${metadata.utm_campaign}`,
        metadata.utm_content && `UTM content: ${metadata.utm_content}`,
        metadata.utm_term && `UTM term: ${metadata.utm_term}`,
        metadata.gclid && `gclid: ${metadata.gclid}`,
        metadata.yclid && `yclid: ${metadata.yclid}`,
        metadata.landingPage && `Страница входа: ${metadata.landingPage}`,
        metadata.referrer && `Referrer: ${metadata.referrer}`,
      ].filter((line): line is string => Boolean(line))
      const noteText = [
        'Заявка с сайта «Чашка кофе»',
        metadata.subject && `Город: ${metadata.subject}`,
        lead.message && `Комментарий: ${lead.message}`,
        ...attributionLines,
      ].filter(Boolean).join('\n')
      try {
        await request('/api/v4/leads/notes', { method: 'POST', body: JSON.stringify([{ entity_id: created.id, note_type: 'common', params: { text: noteText } }]) })
      } catch (error) {
        console.error('amoCRM franchise lead note sync failed', error)
      }
    }
    return created?.id ?? null
  }

  async function exchangeAuthorizationCode(code: string) {
    if (!env.AMOCRM_SUBDOMAIN || !env.AMOCRM_CLIENT_ID || !env.AMOCRM_CLIENT_SECRET || !env.AMOCRM_REDIRECT_URI) throw new Error('amoCRM OAuth is not configured')
    const response = await fetch(`https://${env.AMOCRM_SUBDOMAIN}.amocrm.ru/oauth2/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: env.AMOCRM_CLIENT_ID, client_secret: env.AMOCRM_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: env.AMOCRM_REDIRECT_URI }) })
    if (!response.ok) throw new Error(`amoCRM OAuth exchange failed (${response.status})`)
    return response.json() as Promise<AmoTokenResponse>
  }

  return { configured, createFranchiseLead, exchangeAuthorizationCode }
}
