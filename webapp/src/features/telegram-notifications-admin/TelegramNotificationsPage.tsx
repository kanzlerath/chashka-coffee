import {
  createTelegramRecipientRequestSchema,
  deleteTelegramRecipientResponseSchema,
  telegramCandidatesResponseSchema,
  telegramRecipientResponseSchema,
  telegramSettingsResponseSchema,
  testTelegramRecipientResponseSchema,
  updateTelegramRecipientRequestSchema,
  type OperationalNotificationEvent,
  type TelegramCandidate,
  type TelegramRecipient,
} from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'

import { AdminPageHeader } from '@/components/admin'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Typography } from '@/components/ui/typography'
import { useAuth } from '@/features/auth'

type EventOption = { value: OperationalNotificationEvent; label: string; description: string }
type EventGroup = { label: string; options: readonly EventOption[] }

const eventGroups: readonly EventGroup[] = [
  { label: 'Заказы', options: [
    { value: 'COFFEE_ORDER', label: 'Заказы кофе', description: 'Онлайн-заказ на самовывоз.' },
    { value: 'CAKE_REQUEST', label: 'Кондитерская', description: 'Форма заказа торта или десерта.' },
  ] },
  { label: 'Обращения гостей', options: [
    { value: 'FOOTER_INQUIRY', label: 'Вопросы и идеи', description: 'Самая нижняя форма в футере.' },
    { value: 'CONTACT_REQUEST', label: 'Страница контактов', description: 'Форма «Напишите нам» в контактах.' },
    { value: 'RESERVATION_REQUEST', label: 'Бронирования', description: 'Заявка на бронирование столика.' },
    { value: 'BANQUET_REQUEST', label: 'Банкеты', description: 'Форма на странице банкетов.' },
    { value: 'FRANCHISE_REQUEST', label: 'Франшиза', description: 'Форма получения презентации.' },
    { value: 'EVENT_REGISTRATION', label: 'Регистрации на события', description: 'Форма записи на странице события.' },
  ] },
  { label: 'Команда', options: [
    { value: 'JOB_APPLICATION', label: 'Отклики на вакансии', description: 'Отклик на конкретную вакансию.' },
    { value: 'JOB_GENERAL_INQUIRY', label: 'Обращения о работе', description: 'Форма «Расскажите о себе» без вакансии.' },
  ] },
] as const
export function TelegramNotificationsPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const [candidate, setCandidate] = useState<TelegramCandidate | null>(null)
  const settings = useQuery({ queryKey: ['admin', 'telegram'], queryFn: () => api.request('/api/admin/telegram', telegramSettingsResponseSchema) })
  const candidates = useQuery({
    queryKey: ['admin', 'telegram', 'candidates'],
    enabled: false,
    queryFn: () => api.request('/api/admin/telegram/candidates', telegramCandidatesResponseSchema),
  })
  const add = useMutation({
    mutationFn: (input: { candidate: TelegramCandidate; eventTypes: OperationalNotificationEvent[]; name: string }) => api.request('/api/admin/telegram/recipients', telegramRecipientResponseSchema, {
      method: 'POST',
      body: createTelegramRecipientRequestSchema.parse({ ...input.candidate, name: input.name, eventTypes: input.eventTypes }),
    }),
    onSuccess: () => {
      setCandidate(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'telegram'] })
      void candidates.refetch()
    },
  })

  const connectedChatIds = new Set(settings.data?.recipients.map((recipient) => recipient.chatId))
  const availableCandidates = candidates.data?.candidates.filter((item) => !connectedChatIds.has(item.chatId)) ?? []
  const botLink = settings.data?.botUsername ? `https://t.me/${settings.data.botUsername}` : null

  return <section className="admin-page admin-page-editor">
    <AdminPageHeader title="Уведомления в Telegram" />

    {!settings.isPending && !settings.data?.configured ? <Alert variant="destructive">
      <AlertTitle>Бот не настроен на сервере</AlertTitle>
      <AlertDescription>Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME в окружение backend. Получателей можно будет подключить после перезапуска API.</AlertDescription>
    </Alert> : null}

    <Card>
      <CardHeader>
        <CardTitle>Подключить человека</CardTitle>
        <CardDescription>Сначала человек открывает бота и нажимает Start. Затем обновите список недавних диалогов и выберите его.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {botLink ? <Button asChild variant="outline"><Typography as="a" href={botLink} target="_blank" rel="noreferrer" variant="control">Открыть @{settings.data?.botUsername}</Typography></Button> : null}
          <Button disabled={!settings.data?.configured || candidates.isFetching} onClick={() => void candidates.refetch()}>{candidates.isFetching ? 'Ищем…' : 'Обновить список'}</Button>
        </div>
        {candidates.isError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">Не удалось получить диалоги. Убедитесь, что токен верный и для бота не включён webhook.</Typography> : null}
        {candidates.isFetched && availableCandidates.length === 0 ? <Typography tone="muted" variant="bodySm">Новых диалогов нет. Попросите человека нажать Start или отправить боту любое сообщение, затем обновите список.</Typography> : null}
        {availableCandidates.length > 0 ? <div className="grid gap-2">
          {availableCandidates.map((item) => <button key={item.chatId} type="button" className="flex items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors hover:bg-muted/50" onClick={() => setCandidate(item)}>
            <span><Typography as="strong" className="block" variant="bodySmMedium">{item.name}</Typography><Typography as="small" tone="muted" variant="caption">{item.username ? `@${item.username}` : `Telegram ID ${item.chatId}`}</Typography></span>
            <Typography as="span" tone="primary" variant="bodySmMedium">Выбрать</Typography>
          </button>)}
        </div> : null}
      </CardContent>
    </Card>

    {candidate ? <NewRecipientCard candidate={candidate} pending={add.isPending} error={add.isError} onCancel={() => setCandidate(null)} onSave={(name, eventTypes) => add.mutate({ candidate, name, eventTypes })} /> : null}

    <div className="grid gap-3">
      <div><Typography as="h2" variant="h5">Получатели</Typography><Typography className="mt-1" tone="muted" variant="bodySm">Каждый человек получает только отмеченные для него события.</Typography></div>
      {settings.isPending ? <Typography className="admin-state-message" variant="bodySm">Загружаем настройки…</Typography> : null}
      {settings.isError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">Не удалось загрузить настройки Telegram.</Typography> : null}
      {!settings.isPending && settings.data?.recipients.length === 0 ? <Card><CardContent className="py-10"><Typography align="center" tone="muted" variant="bodySm">Пока никто не подключён.</Typography></CardContent></Card> : null}
      {settings.data?.recipients.map((recipient) => <RecipientCard key={`${recipient.id}:${recipient.updatedAt}`} recipient={recipient} configured={settings.data.configured} />)}
    </div>
  </section>
}

function NewRecipientCard({ candidate, pending, error, onCancel, onSave }: { candidate: TelegramCandidate; pending: boolean; error: boolean; onCancel: () => void; onSave: (name: string, events: OperationalNotificationEvent[]) => void }) {
  const [name, setName] = useState(candidate.name)
  const [events, setEvents] = useState<OperationalNotificationEvent[]>([])
  return <Card className="border-primary/40">
    <CardHeader><CardTitle>Что отправлять для {candidate.name}</CardTitle><CardDescription>Название можно уточнить — например, добавить ресторан или роль человека.</CardDescription></CardHeader>
    <CardContent className="grid gap-5">
      <Input aria-label="Название получателя" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      <EventSelector value={events} onChange={setEvents} />
      {error ? <Typography className="admin-state-message admin-state-error" variant="bodySm">Не удалось подключить. Возможно, этот аккаунт уже добавлен.</Typography> : null}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>Отмена</Button><Button disabled={pending || !name.trim() || events.length === 0} onClick={() => onSave(name.trim(), events)}>{pending ? 'Подключаем…' : 'Подключить'}</Button></div>
    </CardContent>
  </Card>
}

function RecipientCard({ recipient, configured }: { recipient: TelegramRecipient; configured: boolean }) {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState(recipient.name)
  const [events, setEvents] = useState(recipient.eventTypes)
  const [active, setActive] = useState(recipient.isActive)
  const [open, setOpen] = useState(false)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'telegram'] })
  const save = useMutation({ mutationFn: () => api.request(`/api/admin/telegram/recipients/${recipient.id}`, telegramRecipientResponseSchema, { method: 'PUT', body: updateTelegramRecipientRequestSchema.parse({ name, eventTypes: events, isActive: active }) }), onSuccess: refresh })
  const test = useMutation({ mutationFn: () => api.request(`/api/admin/telegram/recipients/${recipient.id}/test`, testTelegramRecipientResponseSchema, { method: 'POST' }), onSuccess: refresh })
  const remove = useMutation({ mutationFn: () => api.request(`/api/admin/telegram/recipients/${recipient.id}`, deleteTelegramRecipientResponseSchema, { method: 'DELETE' }), onSuccess: refresh })
  const changed = name !== recipient.name || active !== recipient.isActive || [...events].sort().join() !== [...recipient.eventTypes].sort().join()

  const eventSummary = getEventSummary(events)

  return <Collapsible open={open} onOpenChange={setOpen} asChild>
    <Card>
      <CardHeader className={open ? 'border-b' : undefined}>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:gap-5">
          <CollapsibleTrigger asChild>
            <button type="button" className="group flex min-w-0 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label={`${open ? 'Свернуть' : 'Настроить'} уведомления для ${recipient.name}`}>
              <span className="min-w-0 flex-1">
                <CardTitle>{recipient.name}</CardTitle>
                <CardDescription className="mt-1 truncate">{recipient.username ? `@${recipient.username}` : `Telegram ID ${recipient.chatId}`} · {eventSummary}</CardDescription>
                {changed ? <Typography as="span" className="mt-1 block" tone="primary" variant="caption">Есть несохранённые изменения</Typography> : null}
              </span>
              <span className="grid size-9 shrink-0 place-items-center rounded-full border text-muted-foreground transition-colors group-hover:bg-muted" aria-hidden="true">
                <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
              </span>
            </button>
          </CollapsibleTrigger>
          <label className="flex items-center gap-2 sm:gap-3"><Typography as="span" className="hidden sm:inline" variant="bodySmMedium">{active ? 'Включено' : 'Пауза'}</Typography><Switch checked={active} onCheckedChange={(checked) => { setActive(checked); setOpen(true) }} /></label>
        </div>
      </CardHeader>
      <CollapsibleContent>
        <CardContent className="grid gap-5">
          <Input aria-label={`Название получателя ${recipient.name}`} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          <EventSelector value={events} onChange={setEvents} />
          {recipient.lastError ? <Alert variant="destructive"><AlertTitle>Последняя отправка не удалась</AlertTitle><AlertDescription>{recipient.lastError}</AlertDescription></Alert> : recipient.lastSentAt ? <Typography tone="muted" variant="bodyXs">Последняя успешная отправка: {new Date(recipient.lastSentAt).toLocaleString('ru-RU')}</Typography> : null}
          {save.isError || test.isError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">Действие не выполнено. Проверьте настройки бота и попробуйте снова.</Typography> : null}
          <div className="flex flex-wrap justify-between gap-2"><Button disabled={remove.isPending} variant="ghost" onClick={() => { if (window.confirm(`Отключить ${recipient.name} от Telegram-уведомлений?`)) remove.mutate() }}>{remove.isPending ? 'Удаляем…' : 'Удалить'}</Button><div className="flex gap-2"><Button disabled={!configured || test.isPending} variant="outline" onClick={() => test.mutate()}>{test.isPending ? 'Отправляем…' : 'Тест'}</Button><Button disabled={!changed || !name.trim() || events.length === 0 || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Сохраняем…' : 'Сохранить'}</Button></div></div>
        </CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>
}

function getEventSummary(events: OperationalNotificationEvent[]) {
  if (events.length === 0) return 'уведомления не выбраны'
  if (events.length === 1) return eventGroups.flatMap((group) => group.options).find((option) => option.value === events[0])?.label ?? '1 тип уведомлений'
  const ending = events.length >= 5 && events.length <= 20 ? 'типов' : events.length % 10 >= 2 && events.length % 10 <= 4 ? 'типа' : 'типов'
  return `${events.length} ${ending} уведомлений`
}

function EventSelector({ value, onChange }: { value: OperationalNotificationEvent[]; onChange: (events: OperationalNotificationEvent[]) => void }) {
  return <div className="grid gap-5">{eventGroups.map((group) => <section className="grid gap-2" key={group.label}>
    <Typography as="h3" variant="bodySmMedium">{group.label}</Typography>
    <div className="grid gap-2 sm:grid-cols-2">{group.options.map((option) => {
      const checked = value.includes(option.value)
      return <label key={option.value} className="flex cursor-pointer gap-3 rounded-xl border p-4 has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-primary/5">
        <Checkbox checked={checked} onCheckedChange={() => onChange(checked ? value.filter((event) => event !== option.value) : [...value, option.value])} />
        <span><Typography as="strong" className="block" variant="bodySmMedium">{option.label}</Typography><Typography as="small" className="mt-1 block" tone="muted" variant="caption">{option.description}</Typography></span>
      </label>
    })}</div>
  </section>)}</div>
}
