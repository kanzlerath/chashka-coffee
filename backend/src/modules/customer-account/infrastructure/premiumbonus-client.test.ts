import { describe, expect, test } from 'bun:test'

import { createPremiumBonusGateway } from './premiumbonus-client'

describe('PremiumBonus gateway', () => {
  test('keeps the API token server-side and maps the customer profile', async () => {
    const requests: Request[] = []
    const gateway = createPremiumBonusGateway({
      apiToken: 'developer-token',
      baseUrl: 'https://site-v2.apipb.ru/',
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({
          success: true,
          is_registered: true,
          blocked: false,
          client_id: 'pb-client-1',
          phone: '+7 (913) 123-45-67',
          name: 'Анна',
          surname: 'Иванова',
          middle_name: null,
          email: null,
          card_number: '123456',
          balance: 725.5,
        })
      },
    })

    await expect(gateway.getCustomer('79131234567')).resolves.toMatchObject({
      registered: true,
      blocked: false,
      clientId: 'pb-client-1',
      phone: '79131234567',
      balance: 725.5,
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('https://site-v2.apipb.ru/buyer-info')
    expect(requests[0].headers.get('Authorization')).toBe('developer-token')
    expect(await requests[0].json()).toEqual({ identificator: '79131234567' })
  })

  test('uses official custom-code and order-code methods', async () => {
    const calls: Array<{ path: string; body: unknown }> = []
    const gateway = createPremiumBonusGateway({
      apiToken: 'developer-token',
      baseUrl: 'https://site-v2.apipb.ru',
      fetch: async (input, init) => {
        const request = new Request(input, init)
        calls.push({ path: new URL(request.url).pathname, body: await request.json() })
        if (request.url.endsWith('/generate-order-code')) {
          return Response.json({ success: true, order_code: '481516' })
        }
        return Response.json({ success: true })
      },
    })

    await gateway.sendLoginCode('79131234567')
    await gateway.verifyLoginCode('79131234567', '1234')
    await expect(gateway.generateOrderCode('79131234567')).resolves.toBe('481516')

    expect(calls).toEqual([
      {
        path: '/send-custom-code',
        body: { phone: '79131234567', text: 'Код для входа в «Чашку кофе»: {{code}}' },
      },
      {
        path: '/verify-custom-code',
        body: { phone: '79131234567', code: '1234' },
      },
      {
        path: '/generate-order-code',
        body: { phone: '79131234567' },
      },
    ])
  })

  test('turns provider failures into stable customer-account failures', async () => {
    const invalidCodeGateway = createPremiumBonusGateway({
      apiToken: 'developer-token',
      baseUrl: 'https://site-v2.apipb.ru',
      fetch: async () => Response.json({ success: false, error_description: 'Invalid code' }, { status: 400 }),
    })
    await expect(invalidCodeGateway.verifyLoginCode('79131234567', '0000'))
      .rejects.toMatchObject({ code: 'code_invalid' })

    const invalidCodeWithOkStatusGateway = createPremiumBonusGateway({
      apiToken: 'developer-token',
      baseUrl: 'https://site-v2.apipb.ru',
      fetch: async () => Response.json({ success: false, error_description: 'Invalid code' }),
    })
    await expect(invalidCodeWithOkStatusGateway.verifyLoginCode('79131234567', '0000'))
      .rejects.toMatchObject({ code: 'code_invalid' })

    const throttledGateway = createPremiumBonusGateway({
      apiToken: 'developer-token',
      baseUrl: 'https://site-v2.apipb.ru',
      fetch: async () => Response.json({ success: false }, { status: 429 }),
    })
    await expect(throttledGateway.sendLoginCode('79131234567'))
      .rejects.toMatchObject({ code: 'too_many_requests' })
  })
})
