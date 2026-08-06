import { describe, expect, test } from 'bun:test'
import { FOOTER_QUESTION_LEAD_SOURCE, JOB_GENERAL_LEAD_SOURCE, JOB_OPENING_LEAD_SOURCE } from '@chashka-coffee/contracts'

import { getPublicFormSuccessMessage, PUBLIC_FORM_SUCCESS_EVENT } from '../src/lib/form-success'

describe('public form success messages', () => {
  test('uses one stable browser event for all public forms', () => {
    expect(PUBLIC_FORM_SUCCESS_EVENT).toBe('chashka:form-success')
  })

  test('identifies the footer inquiry instead of showing a generic confirmation', () => {
    expect(getPublicFormSuccessMessage({ type: 'CONTACT', source: FOOTER_QUESTION_LEAD_SOURCE })).toEqual({
      eyebrow: 'Вопросы и идеи',
      title: 'Сообщение получено',
      copy: 'Передадим его нужной команде и скоро ответим по указанным контактам.',
    })
  })

  test('gives franchise inquiries their own confirmation', () => {
    expect(getPublicFormSuccessMessage({ type: 'FRANCHISE' }).eyebrow).toBe('Франшиза')
  })

  test('includes the event name in registration confirmation', () => {
    expect(getPublicFormSuccessMessage({ type: 'EVENT_REGISTRATION', eventTitle: 'Вечер винила' }).copy).toContain('«Вечер винила»')
  })

  test('distinguishes a general job inquiry from an opening response', () => {
    const general = getPublicFormSuccessMessage({ type: 'JOB', source: JOB_GENERAL_LEAD_SOURCE })
    const opening = getPublicFormSuccessMessage({ type: 'JOB', source: JOB_OPENING_LEAD_SOURCE })

    expect(general.title).toBe('Спасибо, что рассказали о себе')
    expect(opening.title).toBe('Спасибо за отклик')
  })

  test('falls back safely for a future form type', () => {
    expect(getPublicFormSuccessMessage({ type: 'FUTURE_FORM' }).title).toBe('Мы всё получили')
  })
})
