import { adminBulkUpdateRequestSchema, adminBulkUpdateResponseSchema, contentEntryListResponseSchema, contentEntryResponseSchema, operationSuccessResponseSchema, type ContentEntry, type ContentEntryType, type UpsertContentEntryRequest } from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { AdminBulkBar, AdminDraftRecovery, AdminField, AdminFormIntro, AdminListToolbar, AdminPageHeader, AdminPublicationPanel, publicationOptions } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import { useAuth } from '@/features/auth'
import { AdminImageField } from '@/features/media-admin'
import { nullableDraftText } from '@/lib/form-drafts'
import { useEditorDraft } from '@/hooks/use-editor-draft'
import { BlockEditor } from './BlockEditor'
import { ContentPreview } from './ContentPreview'
import { contentSaveErrorMessage, validateContentDraft, type ContentDraftValidation } from './content-editor-validation'

type ContentPageProps = { type: ContentEntryType; mode?: 'list' | 'create' | 'edit'; entryId?: string }
const empty = (type: ContentEntryType): UpsertContentEntryRequest => ({ type, status: 'DRAFT', publishAt: null, slug: '', title: '', excerpt: null, body: null, blocks: [], imageUrl: null, ctaLabel: null, ctaUrl: null, startsAt: null, endsAt: null, eventStartsAt: null, location: null, priceKopecks: null, registrationEnabled: false, isFeatured: false, position: 10 })
const nullable = nullableDraftText
const toDateInput = (value: string | null) => value ? value.slice(0, 16) : ''
const toIso = (value: string) => value ? new Date(value).toISOString() : null
const advancedFields = new Set<keyof UpsertContentEntryRequest>(['slug', 'position', 'startsAt', 'endsAt', 'ctaLabel', 'ctaUrl', 'body'])

export function ContentPage({ type, mode = 'list', entryId }: ContentPageProps) {
  if (mode === 'list') return <ContentList type={type} />
  return <ContentEditor type={type} mode={mode} entryId={entryId} />
}

function contentMeta(type: ContentEntryType) {
  if (type === 'PROMOTION') return { title: 'Акции', single: 'акцию', base: '/content/promotions', create: '/content/promotions/new', edit: '/content/promotions/$entryId', description: 'Специальные предложения, сроки действия и условия для гостей.' } as const
  if (type === 'EVENT') return { title: 'События', single: 'событие', base: '/content/events', create: '/content/events/new', edit: '/content/events/$entryId', description: 'Афиша, даты, места и регистрация на мероприятия.' } as const
  return { title: 'Журнал', single: 'статью', base: '/content/journal', create: '/content/journal/new', edit: '/content/journal/$entryId', description: 'Статьи о кофе, еде, людях и жизни ресторанов.' } as const
}

function useEntries(type: ContentEntryType) {
  const { api } = useAuth()
  return useQuery({ queryKey: ['admin', 'content', type], queryFn: () => api.request(`/api/admin/content?type=${type}`, contentEntryListResponseSchema) })
}

function ContentList({ type }: { type: ContentEntryType }) {
  const entries = useEntries(type); const meta = contentMeta(type); const { api } = useAuth(); const queryClient = useQueryClient()
  const requestedStatus = new URLSearchParams(window.location.search).get('status')
  const initialStatus = requestedStatus && ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].includes(requestedStatus) ? requestedStatus as ContentEntry['status'] : 'ALL'
  const expiredOnly = new URLSearchParams(window.location.search).get('expired') === '1'
  const [query, setQuery] = useState(''); const [status, setStatus] = useState<'ALL' | ContentEntry['status']>(initialStatus); const [selectedIds, setSelectedIds] = useState<string[]>([]); const [bulkStatus, setBulkStatus] = useState<ContentEntry['status']>('PUBLISHED')
  const visible = useMemo(() => { const needle = query.trim().toLocaleLowerCase('ru-RU'); const now = Date.now(); return entries.data?.entries.filter((entry) => (status === 'ALL' || entry.status === status) && (!expiredOnly || Boolean(entry.endsAt && new Date(entry.endsAt).getTime() < now)) && (!needle || `${entry.title} ${entry.excerpt ?? ''}`.toLocaleLowerCase('ru-RU').includes(needle))) ?? [] }, [entries.data, expiredOnly, query, status])
  const bulkUpdate = useMutation({ mutationFn: () => api.request('/api/admin/workspace/bulk-status', adminBulkUpdateResponseSchema, { method: 'POST', body: adminBulkUpdateRequestSchema.parse({ resource: 'CONTENT', ids: selectedIds, status: bulkStatus }) }), onSuccess: () => { setSelectedIds([]); void queryClient.invalidateQueries({ queryKey: ['admin', 'content', type] }); void queryClient.invalidateQueries({ queryKey: ['admin', 'workspace'] }) } })
  const toggle = (id: string) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id])
  return <section className="admin-page"><AdminPageHeader eyebrow="Материалы" title={meta.title} description={meta.description} actions={<Button asChild><Link to={meta.create}>Добавить {meta.single}</Link></Button>} /><AdminListToolbar query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} statusOptions={[{ value: 'ALL', label: 'Все статусы' }, { value: 'DRAFT', label: 'Черновики' }, { value: 'SCHEDULED', label: 'Запланировано' }, { value: 'PUBLISHED', label: 'Опубликовано' }, { value: 'ARCHIVED', label: 'Архив' }]} placeholder="По заголовку и описанию…" /><AdminBulkBar count={selectedIds.length} action={bulkStatus} onActionChange={setBulkStatus} options={[{ value: 'DRAFT', label: 'В черновики' }, { value: 'PUBLISHED', label: 'Опубликовать' }, { value: 'ARCHIVED', label: 'В архив' }]} pending={bulkUpdate.isPending} onApply={() => bulkUpdate.mutate()} onClear={() => setSelectedIds([])} /><Card><CardHeader><CardTitle>Все материалы</CardTitle><CardDescription>{entries.data ? `${visible.length} из ${entries.data.entries.length}` : 'Загружаем…'}</CardDescription></CardHeader><CardContent className="admin-catalog-list">
    {visible.map((entry) => <article className="admin-selectable-row" key={entry.id}><input aria-label={`Выбрать ${entry.title}`} checked={selectedIds.includes(entry.id)} type="checkbox" onChange={() => toggle(entry.id)} /><Link className="admin-catalog-row" params={{ entryId: entry.id }} to={meta.edit}><span className="admin-catalog-thumb">{entry.imageUrl ? <img alt="" src={entry.imageUrl} /> : <span>Фото</span>}</span><span><strong>{entry.title}</strong><small>{entry.excerpt || 'Короткое описание не заполнено'}</small></span><span className={`admin-status admin-status-${entry.status.toLowerCase()}`}>{statusLabel[entry.status]}</span><b>{entry.isFeatured ? 'На главной' : ''}</b></Link></article>)}
    {!entries.isPending && entries.data?.entries.length === 0 ? <p className="admin-empty-copy">Материалов пока нет. Новая запись сначала сохранится как черновик.</p> : null}{entries.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить материалы.</p> : null}
    {bulkUpdate.isError ? <p className="admin-state-message admin-state-error">Не удалось обновить выбранные материалы.</p> : null}
  </CardContent></Card></section>
}

function ContentEditor({ type, mode, entryId }: { type: ContentEntryType; mode: 'create' | 'edit'; entryId?: string }) {
  const { api } = useAuth(); const navigate = useNavigate(); const queryClient = useQueryClient(); const entries = useEntries(type); const meta = contentMeta(type)
  const selected = entries.data?.entries.find((entry) => entry.id === entryId)
  const editor = useEditorDraft<UpsertContentEntryRequest>({ key: `content:${entryId ?? `new:${type}`}`, initialValue: selected ? toDraft(selected) : empty(type), sourceVersion: selected?.updatedAt ?? (mode === 'create' ? 'new' : 'loading'), enabled: mode === 'create' || Boolean(selected) })
  const { draft, setDraft } = editor
  const [draftValidation, setDraftValidation] = useState<Extract<ContentDraftValidation, { success: false }> | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  function change<K extends keyof UpsertContentEntryRequest>(key: K, value: UpsertContentEntryRequest[K]) { setDraft((current) => ({ ...current, [key]: value })); setDraftValidation(null); if (!save.isPending) save.reset() }
  function changeStatus(status: UpsertContentEntryRequest['status']) { setDraft((current) => ({ ...current, status, publishAt: status === 'SCHEDULED' ? current.publishAt ?? new Date(Date.now() + 3_600_000).toISOString() : null })) }
  const save = useMutation({ mutationFn: (input: UpsertContentEntryRequest) => api.request(mode === 'edit' ? `/api/admin/content/${entryId}` : '/api/admin/content', contentEntryResponseSchema, { method: mode === 'edit' ? 'PUT' : 'POST', body: input }), onSuccess: async (_response, input) => { editor.markSaved(input); await queryClient.invalidateQueries({ queryKey: ['admin', 'content', type] }); await queryClient.invalidateQueries({ queryKey: ['admin', 'workspace'] }); await navigate({ to: meta.base }) } })
  const remove = useMutation({ mutationFn: () => api.request(`/api/admin/content/${entryId}`, operationSuccessResponseSchema, { method: 'DELETE' }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'content', type] }); await navigate({ to: meta.base }) } })

  function submit() {
    if (save.isPending) return
    const validation = validateContentDraft(draft)
    if (!validation.success) {
      setDraftValidation(validation)
      save.reset()
      if (validation.issues.some((issue) => advancedFields.has(issue.path[0] as keyof UpsertContentEntryRequest))) setAdvancedOpen(true)
      return
    }
    setDraftValidation(null)
    save.mutate(validation.data)
  }

  if (mode === 'edit' && entries.isPending) return <section className="admin-page"><p className="admin-state-message">Загружаем материал…</p></section>
  if (mode === 'edit' && !selected) return <section className="admin-page"><AdminPageHeader eyebrow="Материалы" title="Материал не найден" description="Возможно, запись была удалена или адрес устарел." actions={<Button asChild variant="outline"><Link to={meta.base}>Вернуться к списку</Link></Button>} /></section>

  const formId = 'content-editor-form'
  return <section className="admin-page admin-page-editor"><AdminPageHeader eyebrow={meta.title} title={mode === 'create' ? `Новая ${type === 'ARTICLE' ? 'статья' : type === 'PROMOTION' ? 'акция' : 'афиша'}` : selected?.title ?? 'Редактирование'} description="Сначала сохраните черновик. Публикуйте материал только после проверки текста, фото и ссылок." actions={<Button asChild variant="outline"><Link to={meta.base}>К списку</Link></Button>} />
    {editor.recovery ? <AdminDraftRecovery savedAt={editor.recovery.savedAt} onRestore={editor.restore} onDiscard={editor.discardRecovery} /> : null}
    <div className="admin-editor-layout"><Card className="admin-editor-surface"><CardHeader><CardTitle>Содержание</CardTitle><CardDescription>Эти данные увидят гости на карточке и странице материала.</CardDescription></CardHeader><CardContent><form className="admin-form-stack" id={formId} noValidate onSubmit={(event) => { event.preventDefault(); submit() }}>
      <AdminFormIntro>Для черновика обязателен заголовок; адрес страницы сформируется автоматически. Если добавили блок, заполните его обязательные поля.</AdminFormIntro>
      <AdminField label="Заголовок" hint="Коротко и по делу: до 8–10 слов" required><Input required placeholder={type === 'PROMOTION' ? 'Завтраки по будням' : type === 'EVENT' ? 'Джазовый вечер' : 'Как выбрать кофе для дома'} value={draft.title} onChange={(event) => change('title', event.target.value)} /></AdminField>
      <AdminField label="Короткое описание" hint="Показывается в карточках и анонсах"><Textarea placeholder="О чём материал и почему гостю стоит открыть его…" value={draft.excerpt ?? ''} onChange={(event) => change('excerpt', nullable(event.target.value))} /></AdminField>
      <AdminField label="Обложка" hint="Показывается в списках и в первом экране материала."><AdminImageField value={draft.imageUrl ?? null} onChange={(imageUrl) => change('imageUrl', imageUrl)} /></AdminField>
      {type === 'EVENT' ? <section className="admin-form-section"><h3>Когда и где</h3><div className="admin-form-grid-2"><AdminField label="Дата и время" hint="Часовой пояс Новосибирска"><Input type="datetime-local" value={toDateInput(draft.eventStartsAt)} onChange={(event) => change('eventStartsAt', toIso(event.target.value))} /></AdminField><AdminField label="Место" hint="Ресторан или полный адрес"><Input placeholder="Чашка кофе на Красном проспекте" value={draft.location ?? ''} onChange={(event) => change('location', nullable(event.target.value))} /></AdminField><AdminField label="Цена билета, ₽" hint="Оставьте пустым для бесплатного события"><Input min={0} type="number" value={(draft.priceKopecks ?? 0) / 100 || ''} onChange={(event) => change('priceKopecks', event.target.value ? Number(event.target.value) * 100 : null)} /></AdminField><label className="admin-check-row"><input checked={draft.registrationEnabled} type="checkbox" onChange={(event) => change('registrationEnabled', event.target.checked)} /><span><strong>Принимать регистрации</strong><small>На публичной странице появится форма записи.</small></span></label></div></section> : null}
      <BlockEditor blocks={draft.blocks} invalidBlockIds={draftValidation?.invalidBlockIds} preview={{ title: draft.title, excerpt: draft.excerpt, imageUrl: draft.imageUrl }} onChange={(blocks) => change('blocks', blocks)} />
      <details className="admin-advanced-fields" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}><summary>Ссылка, сроки показа и технические настройки</summary><div className="admin-form-stack pt-4"><div className="admin-form-grid-2"><AdminField label="Адрес страницы" hint="Заполнится автоматически по заголовку"><Input placeholder="jazz-evening" value={draft.slug} onChange={(event) => change('slug', event.target.value)} /></AdminField><AdminField label="Порядок отображения" hint="Меньшее число показывается раньше"><Input min={0} type="number" value={draft.position} onChange={(event) => change('position', Number(event.target.value))} /></AdminField><AdminField label="Показывать с"><Input type="datetime-local" value={toDateInput(draft.startsAt)} onChange={(event) => change('startsAt', toIso(event.target.value))} /></AdminField><AdminField label="Показывать до"><Input type="datetime-local" value={toDateInput(draft.endsAt)} onChange={(event) => change('endsAt', toIso(event.target.value))} /></AdminField><AdminField label={type === 'PROMOTION' ? 'Текст кнопки в карточке' : 'Текст кнопки'} hint={type === 'PROMOTION' ? 'Если оставить пустым, на карточке будет «Подробнее»' : undefined}><Input placeholder="Подробнее" value={draft.ctaLabel ?? ''} onChange={(event) => change('ctaLabel', nullable(event.target.value))} /></AdminField><AdminField label={type === 'PROMOTION' ? 'Ссылка кнопки в карточке' : 'Ссылка кнопки'} hint={type === 'PROMOTION' ? 'Если оставить пустым, кнопка откроет страницу акции' : undefined}><Input placeholder="/menu или https://…" value={draft.ctaUrl ?? ''} onChange={(event) => change('ctaUrl', nullable(event.target.value))} /></AdminField></div><AdminField label="Резервный сплошной текст" hint="Используется, если содержательные блоки не добавлены"><Textarea value={draft.body ?? ''} onChange={(event) => change('body', nullable(event.target.value))} /></AdminField></div></details>
      <label className="admin-check-row"><input checked={draft.isFeatured} type="checkbox" onChange={(event) => change('isFeatured', event.target.checked)} /><span><strong>Показывать на главной</strong><small>Материал сможет появиться в рекомендованном блоке.</small></span></label>
      {draftValidation ? <Typography aria-live="polite" as="p" className="admin-state-message admin-state-error" role="alert" variant="bodySm">Не удалось сохранить. {draftValidation.messages.join(' ')}</Typography> : null}
      {save.isError ? <Typography aria-live="polite" as="p" className="admin-state-message admin-state-error" role="alert" variant="bodySm">{contentSaveErrorMessage(save.error, draft)}</Typography> : null}
    </form></CardContent></Card>
    <AdminPublicationPanel formId={formId} status={draft.status} options={[...publicationOptions]} onStatusChange={changeStatus} scheduleAt={draft.publishAt} onScheduleAtChange={(value) => change('publishAt', value)} isDirty={editor.isDirty} isSaving={save.isPending} savedAt={selected?.updatedAt} saveLabel="Сохранить материал" preview={{ eyebrow: meta.title, title: draft.title, description: draft.excerpt, imageUrl: draft.imageUrl, badge: statusLabel[draft.status], body: <ContentPreview blocks={draft.blocks} /> }} /></div>
    {mode === 'edit' ? <Card className="admin-danger-zone"><CardHeader><CardTitle>Удаление материала</CardTitle><CardDescription>Материал будет окончательно удалён с сайта и из админки.</CardDescription></CardHeader><CardContent><Button disabled={remove.isPending} variant="destructive" onClick={() => { if (window.confirm(`Удалить «${selected?.title}»?`)) remove.mutate() }}>{remove.isPending ? 'Удаляем…' : 'Удалить материал'}</Button>{remove.isError ? <p className="admin-state-message admin-state-error">Не удалось удалить материал.</p> : null}</CardContent></Card> : null}
  </section>
}

function toDraft(entry: ContentEntry): UpsertContentEntryRequest { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = entry; return draft }
const statusLabel = { DRAFT: 'Черновик', SCHEDULED: 'Запланировано', PUBLISHED: 'Опубликовано', ARCHIVED: 'Архив' } as const
