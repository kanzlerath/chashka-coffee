import { describe, expect, test } from 'bun:test'

import { upsertManagedPageRequestSchema } from './managed-pages'

describe('managed marketing pages', () => {
  test('accepts stable page keys with reorderable visible blocks', () => {
    const page = upsertManagedPageRequestSchema.parse({
      key: 'DELIVERY',
      title: 'Доставка',
      blocks: [{
        id: '018f8d94-1f4f-7000-8000-000000000001',
        type: 'CTA',
        isVisible: true,
        title: 'Закажите любимое',
        text: 'Привезём из ближайшего ресторана.',
        label: 'Перейти к доставке',
        url: 'https://eda.yandex.ru',
      }],
    })

    expect(page.key).toBe('DELIVERY')
    expect(page.blocks[0]?.type).toBe('CTA')
  })
})
