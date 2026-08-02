import { describe, expect, test } from 'bun:test'
import type { ContentBlock, ContentEntryType, UpsertContentEntryRequest } from '@chashka-coffee/contracts'

import {
  contentSaveErrorMessage,
  validateContentDraft,
} from '../src/features/content-admin/content-editor-validation'
import { ApiRequestError } from '../src/platform/api'

function draft(type: ContentEntryType, blocks: ContentBlock[] = []): UpsertContentEntryRequest {
  return {
    type,
    status: 'DRAFT',
    slug: '',
    title: type === 'PROMOTION' ? 'Летняя акция' : type === 'EVENT' ? 'Кофейный вечер' : 'История кофе',
    excerpt: null,
    body: null,
    blocks,
    imageUrl: null,
    ctaLabel: null,
    ctaUrl: null,
    startsAt: null,
    endsAt: null,
    eventStartsAt: null,
    location: null,
    priceKopecks: null,
    registrationEnabled: false,
    isFeatured: false,
    position: 10,
  }
}

describe('content editor validation', () => {
  test.each(['PROMOTION', 'EVENT', 'ARTICLE'] as const)(
    'prepares a minimal %s draft and generates its address',
    (type) => {
      const result = validateContentDraft(draft(type))

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.slug).not.toBe('')
    },
  )

  test('names a top-level field that prevents saving', () => {
    const result = validateContentDraft({ ...draft('PROMOTION'), imageUrl: 'images/promo.webp' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.messages).toEqual([
        'Поле «Обложка»: укажите ссылку, начинающуюся с /, http:// или https://.',
      ])
    }
  })

  test('points to the title only when an automatic address cannot be generated yet', () => {
    const result = validateContentDraft({ ...draft('EVENT'), title: '' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.messages).toEqual(['Поле «Заголовок»: заполните поле.'])
    }
  })

  test('names the exact collapsed block and nested field that prevents saving', () => {
    const result = validateContentDraft(draft('ARTICLE', [{
      id: '018f8d94-1f4f-7000-8000-000000000001',
      type: 'GALLERY',
      isVisible: true,
      layout: 'GRID',
      images: [{ url: '/images/coffee.webp', alt: '', caption: null }],
    }]))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.messages).toEqual([
        'Блок 1 «Галерея», фото 1 — поле «Описание для доступности»: заполните поле.',
      ])
      expect(result.invalidBlockIds).toEqual(['018f8d94-1f4f-7000-8000-000000000001'])
    }
  })

  test('keeps the backend conflict reason instead of replacing it with a generic hint', () => {
    expect(contentSaveErrorMessage(new ApiRequestError(
      409,
      'CONFLICT',
      'Этот адрес страницы уже занят. Укажите другой.',
    ), draft('EVENT'))).toBe('Этот адрес страницы уже занят. Укажите другой.')
  })
})
