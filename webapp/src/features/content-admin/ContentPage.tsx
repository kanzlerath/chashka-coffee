import { contentEntryListResponseSchema, contentEntryResponseSchema, operationSuccessResponseSchema, upsertContentEntryRequestSchema, type ContentEntry, type ContentEntryType, type UpsertContentEntryRequest } from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { AdminField, AdminFormIntro, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import { nullableDraftText } from '@/lib/form-drafts'
import { toPublicSlug } from '@/lib/slugify'
import { BlockEditor } from './BlockEditor'

type ContentPageProps = { type: ContentEntryType; mode?: 'list' | 'create' | 'edit'; entryId?: string }
const empty = (type: ContentEntryType): UpsertContentEntryRequest => ({ type, status: 'DRAFT', slug: '', title: '', excerpt: null, body: null, blocks: [], imageUrl: null, ctaLabel: null, ctaUrl: null, startsAt: null, endsAt: null, eventStartsAt: null, location: null, priceKopecks: null, registrationEnabled: false, isFeatured: false, position: 10 })
const nullable = nullableDraftText
const toDateInput = (value: string | null) => value ? value.slice(0, 16) : ''
const toIso = (value: string) => value ? new Date(value).toISOString() : null

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
  const entries = useEntries(type); const meta = contentMeta(type)
  return <section className="admin-page"><AdminPageHeader eyebrow="Материалы" title={meta.title} description={meta.description} actions={<Button asChild><Link to={meta.create}>Добавить {meta.single}</Link></Button>} /><Card><CardHeader><CardTitle>Все материалы</CardTitle><CardDescription>{entries.data ? `${entries.data.entries.length} записей` : 'Загружаем…'}</CardDescription></CardHeader><CardContent className="admin-catalog-list">
    {entries.data?.entries.map((entry) => <Link className="admin-catalog-row" key={entry.id} params={{ entryId: entry.id }} to={meta.edit}><span className="admin-catalog-thumb">{entry.imageUrl ? <img alt="" src={entry.imageUrl} /> : <span>Фото</span>}</span><span><strong>{entry.title}</strong><small>{entry.excerpt || 'Короткое описание не заполнено'}</small></span><span className={`admin-status admin-status-${entry.status.toLowerCase()}`}>{statusLabel[entry.status]}</span><b>{entry.isFeatured ? 'На главной' : ''}</b></Link>)}
    {!entries.isPending && entries.data?.entries.length === 0 ? <p className="admin-empty-copy">Материалов пока нет. Новая запись сначала сохранится как черновик.</p> : null}{entries.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить материалы.</p> : null}
  </CardContent></Card></section>
}

function ContentEditor({ type, mode, entryId }: { type: ContentEntryType; mode: 'create' | 'edit'; entryId?: string }) {
  const { api } = useAuth(); const navigate = useNavigate(); const queryClient = useQueryClient(); const entries = useEntries(type); const meta = contentMeta(type)
  const selected = entries.data?.entries.find((entry) => entry.id === entryId)
  const [draft, setDraft] = useState<UpsertContentEntryRequest>(empty(type))
  useEffect(() => { if (mode === 'edit' && selected) setDraft(toDraft(selected)) }, [mode, selected])
  function change<K extends keyof UpsertContentEntryRequest>(key: K, value: UpsertContentEntryRequest[K]) { setDraft((current) => ({ ...current, [key]: value })) }
  const save = useMutation({ mutationFn: () => api.request(mode === 'edit' ? `/api/admin/content/${entryId}` : '/api/admin/content', contentEntryResponseSchema, { method: mode === 'edit' ? 'PUT' : 'POST', body: upsertContentEntryRequestSchema.parse({ ...draft, slug: draft.slug || toPublicSlug(draft.title) }) }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'content', type] }); await navigate({ to: meta.base }) } })
  const remove = useMutation({ mutationFn: () => api.request(`/api/admin/content/${entryId}`, operationSuccessResponseSchema, { method: 'DELETE' }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'content', type] }); await navigate({ to: meta.base }) } })

  if (mode === 'edit' && entries.isPending) return <section className="admin-page"><p className="admin-state-message">Загружаем материал…</p></section>
  if (mode === 'edit' && !selected) return <section className="admin-page"><AdminPageHeader eyebrow="Материалы" title="Материал не найден" description="Возможно, запись была удалена или адрес устарел." actions={<Button asChild variant="outline"><Link to={meta.base}>Вернуться к списку</Link></Button>} /></section>

  return <section className="admin-page admin-page-editor"><AdminPageHeader eyebrow={meta.title} title={mode === 'create' ? `Новая ${type === 'ARTICLE' ? 'статья' : type === 'PROMOTION' ? 'акция' : 'афиша'}` : selected?.title ?? 'Редактирование'} description="Сначала сохраните черновик. Публикуйте материал только после проверки текста, фото и ссылок." actions={<Button asChild variant="outline"><Link to={meta.base}>К списку</Link></Button>} />
    <Card className="admin-editor-surface"><CardHeader><CardTitle>Содержание</CardTitle><CardDescription>Эти данные увидят гости на карточке и странице материала.</CardDescription></CardHeader><CardContent><form className="admin-form-stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      <AdminFormIntro>Обязательны только заголовок и адрес страницы. Остальное можно дополнять постепенно.</AdminFormIntro>
      <AdminField label="Заголовок" hint="Коротко и по делу: до 8–10 слов" required><Input required placeholder={type === 'PROMOTION' ? 'Завтраки по будням' : type === 'EVENT' ? 'Джазовый вечер' : 'Как выбрать кофе для дома'} value={draft.title} onChange={(event) => change('title', event.target.value)} /></AdminField>
      <AdminField label="Короткое описание" hint="Показывается в карточках и анонсах"><Textarea placeholder="О чём материал и почему гостю стоит открыть его…" value={draft.excerpt ?? ''} onChange={(event) => change('excerpt', nullable(event.target.value))} /></AdminField>
      <div className="admin-form-grid-2"><AdminField label="Обложка" hint="Ссылка на изображение из медиатеки"><Input type="url" placeholder="https://…" value={draft.imageUrl ?? ''} onChange={(event) => change('imageUrl', nullable(event.target.value))} /></AdminField><AdminField label="Статус"><select value={draft.status} onChange={(event) => change('status', event.target.value as UpsertContentEntryRequest['status'])}><option value="DRAFT">Черновик — не виден на сайте</option><option value="PUBLISHED">Опубликовано</option><option value="ARCHIVED">Архив</option></select></AdminField></div>
      {type === 'EVENT' ? <section className="admin-form-section"><h3>Когда и где</h3><div className="admin-form-grid-2"><AdminField label="Дата и время" hint="Часовой пояс Новосибирска"><Input type="datetime-local" value={toDateInput(draft.eventStartsAt)} onChange={(event) => change('eventStartsAt', toIso(event.target.value))} /></AdminField><AdminField label="Место" hint="Ресторан или полный адрес"><Input placeholder="Чашка кофе на Красном проспекте" value={draft.location ?? ''} onChange={(event) => change('location', nullable(event.target.value))} /></AdminField><AdminField label="Цена билета, ₽" hint="Оставьте пустым для бесплатного события"><Input min={0} type="number" value={(draft.priceKopecks ?? 0) / 100 || ''} onChange={(event) => change('priceKopecks', event.target.value ? Number(event.target.value) * 100 : null)} /></AdminField><label className="admin-check-row"><input checked={draft.registrationEnabled} type="checkbox" onChange={(event) => change('registrationEnabled', event.target.checked)} /><span><strong>Принимать регистрации</strong><small>На публичной странице появится форма записи.</small></span></label></div></section> : null}
      <BlockEditor blocks={draft.blocks} preview={{ title: draft.title, excerpt: draft.excerpt, imageUrl: draft.imageUrl }} onChange={(blocks) => change('blocks', blocks)} />
      <details className="admin-advanced-fields"><summary>Ссылка, сроки показа и технические настройки</summary><div className="admin-form-stack pt-4"><div className="admin-form-grid-2"><AdminField label="Адрес страницы" hint="Заполнится автоматически по заголовку"><Input placeholder="jazz-evening" value={draft.slug} onChange={(event) => change('slug', event.target.value)} /></AdminField><AdminField label="Порядок отображения" hint="Меньшее число показывается раньше"><Input min={0} type="number" value={draft.position} onChange={(event) => change('position', Number(event.target.value))} /></AdminField><AdminField label="Показывать с"><Input type="datetime-local" value={toDateInput(draft.startsAt)} onChange={(event) => change('startsAt', toIso(event.target.value))} /></AdminField><AdminField label="Показывать до"><Input type="datetime-local" value={toDateInput(draft.endsAt)} onChange={(event) => change('endsAt', toIso(event.target.value))} /></AdminField><AdminField label="Текст кнопки"><Input placeholder="Подробнее" value={draft.ctaLabel ?? ''} onChange={(event) => change('ctaLabel', nullable(event.target.value))} /></AdminField><AdminField label="Ссылка кнопки"><Input placeholder="/menu или https://…" value={draft.ctaUrl ?? ''} onChange={(event) => change('ctaUrl', nullable(event.target.value))} /></AdminField></div><AdminField label="Резервный сплошной текст" hint="Используется, если содержательные блоки не добавлены"><Textarea value={draft.body ?? ''} onChange={(event) => change('body', nullable(event.target.value))} /></AdminField></div></details>
      <label className="admin-check-row"><input checked={draft.isFeatured} type="checkbox" onChange={(event) => change('isFeatured', event.target.checked)} /><span><strong>Показывать на главной</strong><small>Материал сможет появиться в рекомендованном блоке.</small></span></label>
      {save.isError ? <p className="admin-state-message admin-state-error">Не удалось сохранить. Проверьте обязательные поля, ссылки и даты.</p> : null}<div className="admin-form-actions"><Button disabled={save.isPending} size="lg" type="submit">{save.isPending ? 'Сохраняем…' : 'Сохранить материал'}</Button></div>
    </form></CardContent></Card>
    {mode === 'edit' ? <Card className="admin-danger-zone"><CardHeader><CardTitle>Удаление материала</CardTitle><CardDescription>Материал будет окончательно удалён с сайта и из админки.</CardDescription></CardHeader><CardContent><Button disabled={remove.isPending} variant="destructive" onClick={() => { if (window.confirm(`Удалить «${selected?.title}»?`)) remove.mutate() }}>{remove.isPending ? 'Удаляем…' : 'Удалить материал'}</Button>{remove.isError ? <p className="admin-state-message admin-state-error">Не удалось удалить материал.</p> : null}</CardContent></Card> : null}
  </section>
}

function toDraft(entry: ContentEntry): UpsertContentEntryRequest { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = entry; return draft }
const statusLabel = { DRAFT: 'Черновик', PUBLISHED: 'Опубликовано', ARCHIVED: 'Архив' } as const
