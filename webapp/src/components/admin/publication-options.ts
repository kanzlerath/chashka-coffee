export const publicationOptions = [
  { value: 'DRAFT', label: 'Черновик', hint: 'Не виден посетителям.' },
  { value: 'SCHEDULED', label: 'Запланировано', hint: 'Выйдет автоматически.' },
  { value: 'PUBLISHED', label: 'Опубликовано', hint: 'Доступно на сайте.' },
  { value: 'ARCHIVED', label: 'Архив', hint: 'Скрыто, но сохранено.' },
] as const
