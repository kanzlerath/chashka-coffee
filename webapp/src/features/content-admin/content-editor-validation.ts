import {
  upsertContentEntryRequestSchema,
  type ContentBlock,
  type UpsertContentEntryRequest,
} from '@chashka-coffee/contracts'
import { ZodError, type ZodIssue } from 'zod'

import { toPublicSlug } from '@/lib/slugify'
import { ApiRequestError } from '@/platform/api'

const entryFieldLabels: Record<string, string> = {
  slug: 'Адрес страницы',
  title: 'Заголовок',
  excerpt: 'Короткое описание',
  body: 'Резервный сплошной текст',
  blocks: 'Содержимое страницы',
  imageUrl: 'Обложка',
  ctaLabel: 'Текст кнопки',
  ctaUrl: 'Ссылка кнопки',
  startsAt: 'Показывать с',
  endsAt: 'Показывать до',
  eventStartsAt: 'Дата и время',
  location: 'Место',
  priceKopecks: 'Цена билета',
  position: 'Порядок отображения',
}

const blockTypeLabels: Record<ContentBlock['type'], string> = {
  TEXT: 'Текст',
  IMAGE: 'Изображение',
  SPLIT: 'Текст + фото',
  GALLERY: 'Галерея',
  QUOTE: 'Цитата',
  VIDEO: 'Видео',
  CTA: 'Призыв к действию',
}

const blockFieldLabels: Record<string, string> = {
  title: 'Заголовок',
  text: 'Текст',
  imageUrl: 'Изображение',
  alt: 'Alt-текст',
  caption: 'Подпись',
  videoUrl: 'Видео',
  posterUrl: 'Обложка видео',
  label: 'Кнопка',
  url: 'Ссылка',
  images: 'Фотографии',
}

type InvalidContentDraft = {
  success: false
  messages: string[]
  invalidBlockIds: string[]
  issues: ZodIssue[]
}

export type ContentDraftValidation =
  | { success: true; data: UpsertContentEntryRequest }
  | InvalidContentDraft

export function validateContentDraft(draft: UpsertContentEntryRequest): ContentDraftValidation {
  const result = upsertContentEntryRequestSchema.safeParse({
    ...draft,
    slug: draft.slug.trim() || toPublicSlug(draft.title),
  })

  if (result.success) return result

  const issues = result.error.issues.filter((issue) => !(
    issue.path[0] === 'slug'
    && draft.slug.trim() === ''
    && draft.title.trim() === ''
  ))

  return {
    success: false,
    messages: contentValidationMessages(issues, draft),
    invalidBlockIds: invalidBlockIds(issues, draft),
    issues,
  }
}

export function contentSaveErrorMessage(error: unknown, draft: UpsertContentEntryRequest) {
  if (error instanceof ApiRequestError) {
    if (error.code === 'CONFLICT') return error.message
    if (error.code === 'VALIDATION_ERROR') {
      const issues = apiValidationIssues(error.details)
      if (issues.length > 0) return contentValidationMessages(issues, draft).join(' ')
      return 'Сервер отклонил данные материала. Проверьте заполненные поля и повторите сохранение.'
    }
    return `Не удалось сохранить материал: ${error.message}`
  }

  if (error instanceof ZodError) {
    return contentValidationMessages(error.issues, draft).join(' ')
  }

  if (error instanceof TypeError) {
    return 'Нет связи с API. Проверьте, что backend запущен, и повторите сохранение.'
  }

  return 'Не удалось сохранить материал. Повторите попытку.'
}

function contentValidationMessages(issues: ZodIssue[], draft: UpsertContentEntryRequest) {
  return [...new Set(issues.map((issue) => `${issueLocation(issue, draft)}: ${issueReason(issue)}.`))]
}

function issueLocation(issue: ZodIssue, draft: UpsertContentEntryRequest) {
  const [root, blockIndex, nestedField, nestedIndex, nestedProperty] = issue.path
  if (root !== 'blocks' || typeof blockIndex !== 'number') {
    const field = typeof root === 'string' ? entryFieldLabels[root] ?? root : 'Материал'
    return `Поле «${field}»`
  }

  const block = draft.blocks[blockIndex]
  const blockLabel = block ? blockTypeLabels[block.type] : 'Содержимое страницы'
  const prefix = `Блок ${blockIndex + 1} «${blockLabel}»`

  if (nestedField === 'images' && typeof nestedIndex === 'number') {
    const field = typeof nestedProperty === 'string'
      ? blockFieldLabels[nestedProperty] ?? nestedProperty
      : blockFieldLabels.images
    return `${prefix}, фото ${nestedIndex + 1} — поле «${field === 'Alt-текст' ? 'Описание для доступности' : field}»`
  }

  const field = typeof nestedField === 'string' ? blockFieldLabels[nestedField] ?? nestedField : 'Поля блока'
  return `${prefix} — поле «${field}»`
}

function issueReason(issue: ZodIssue) {
  if (issue.code === 'too_small') return 'заполните поле'
  if (issue.code === 'too_big') return 'сократите значение'
  if (issue.code === 'invalid_type') return 'укажите значение в правильном формате'

  if (issue.message === 'Expected an absolute URL or a site-relative path') {
    return 'укажите ссылку, начинающуюся с /, http:// или https://'
  }

  if (issue.code === 'invalid_format') {
    if (issue.format === 'regex') return 'используйте строчные латинские буквы, цифры и дефисы'
    if (issue.format === 'datetime') return 'укажите корректные дату и время'
    if (issue.format === 'uuid') return 'пересоздайте этот блок'
  }

  return 'проверьте значение'
}

function invalidBlockIds(issues: ZodIssue[], draft: UpsertContentEntryRequest) {
  return [...new Set(issues.flatMap((issue) => {
    const [root, blockIndex] = issue.path
    if (root !== 'blocks' || typeof blockIndex !== 'number') return []
    const id = draft.blocks[blockIndex]?.id
    return id ? [id] : []
  }))]
}

function apiValidationIssues(details: unknown): ZodIssue[] {
  if (!Array.isArray(details)) return []
  return details.filter((issue): issue is ZodIssue => Boolean(
    issue
    && typeof issue === 'object'
    && 'code' in issue
    && 'message' in issue
    && 'path' in issue
    && Array.isArray(issue.path),
  ))
}
