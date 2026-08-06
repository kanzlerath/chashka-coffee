import { describe, expect, test } from 'bun:test'

import { FOOTER_QUESTION_LEAD_SOURCE, createLeadRequestSchema } from './leads'

describe('lead contracts', () => {
  test('accepts a footer question or idea with a stable admin source marker', () => {
    const result = createLeadRequestSchema.parse({
      type: 'CONTACT',
      name: 'Анна',
      phone: '+7 913 000-00-00',
      email: null,
      message: 'Есть идея для летнего меню',
      metadata: { source: FOOTER_QUESTION_LEAD_SOURCE },
    })

    expect(result.metadata).toEqual({ source: FOOTER_QUESTION_LEAD_SOURCE })
  })

  test('accepts a confectionery order request as its own operational lead type', () => {
    expect(createLeadRequestSchema.parse({
      type: 'CAKE',
      name: 'Мария',
      phone: '+7 913 000-00-00',
      email: null,
      message: 'Торт на 12 гостей к субботе',
      metadata: { source: 'bakery_order_request', subject: 'День рождения' },
    }).type).toBe('CAKE')
  })
})
