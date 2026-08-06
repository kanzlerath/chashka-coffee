import { FOOTER_QUESTION_LEAD_SOURCE, JOB_GENERAL_LEAD_SOURCE } from '@chashka-coffee/contracts'

export const PUBLIC_FORM_SUCCESS_EVENT = 'chashka:form-success'

export interface PublicFormSuccessContext {
  type?: string
  source?: string
  eventTitle?: string
}

export interface PublicFormSuccessMessage {
  eyebrow: string
  title: string
  copy: string
}

const defaultMessage: PublicFormSuccessMessage = {
  eyebrow: 'Заявка отправлена',
  title: 'Мы всё получили',
  copy: 'Передадим заявку нужной команде и скоро свяжемся с вами по указанным контактам.',
}

export function getPublicFormSuccessMessage(context: PublicFormSuccessContext): PublicFormSuccessMessage {
  if (context.type === 'EVENT_REGISTRATION') {
    const eventName = context.eventTitle?.trim()
    return {
      eyebrow: 'Регистрация принята',
      title: 'Вы в списке',
      copy: eventName
        ? `Мы получили заявку на «${eventName}» и свяжемся с вами для подтверждения.`
        : 'Мы получили вашу заявку и свяжемся с вами для подтверждения регистрации.',
    }
  }

  if (context.type === 'CAKE') return {
    eyebrow: 'Кондитерская',
    title: 'Заявка получена',
    copy: 'Уточним детали заказа, рассчитаем стоимость и скоро свяжемся с вами.',
  }

  if (context.type === 'FRANCHISE') return {
    eyebrow: 'Франшиза',
    title: 'Спасибо за интерес',
    copy: 'Мы получили вашу заявку. Подготовим материалы и скоро свяжемся с вами.',
  }

  if (context.type === 'BANQUET') return {
    eyebrow: 'Банкеты и события',
    title: 'Заявка получена',
    copy: 'Менеджер уточнит детали события и скоро свяжется с вами.',
  }

  if (context.type === 'RESERVATION') return {
    eyebrow: 'Бронирование',
    title: 'Запрос получен',
    copy: 'Скоро свяжемся с вами и подтвердим детали бронирования.',
  }

  if (context.type === 'JOB') {
    const isGeneralInquiry = context.source === JOB_GENERAL_LEAD_SOURCE
    return isGeneralInquiry ? {
      eyebrow: 'Работа в команде',
      title: 'Спасибо, что рассказали о себе',
      copy: 'Мы изучим вашу заявку и свяжемся, если найдём подходящую роль.',
    } : {
      eyebrow: 'Отклик отправлен',
      title: 'Спасибо за отклик',
      copy: 'Мы изучим заявку и свяжемся с вами по указанным контактам.',
    }
  }

  if (context.type === 'CONTACT' && context.source === FOOTER_QUESTION_LEAD_SOURCE) return {
    eyebrow: 'Вопросы и идеи',
    title: 'Сообщение получено',
    copy: 'Передадим его нужной команде и скоро ответим по указанным контактам.',
  }

  if (context.type === 'CONTACT') return {
    eyebrow: 'Обратная связь',
    title: 'Сообщение получено',
    copy: 'Спасибо, что написали нам. Скоро ответим по указанным контактам.',
  }

  return defaultMessage
}
