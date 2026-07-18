import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { contentEntryListResponseSchema, contentEntryResponseSchema, upsertContentEntryRequestSchema, type ContentEntry, type UpsertContentEntryRequest } from '@chashka-coffee/contracts'
import { useMemo, useState } from 'react'
import { AdminPageHeader, AdminTabs } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'

const empty: UpsertContentEntryRequest = { type: 'PROMOTION', status: 'DRAFT', slug: '', title: '', excerpt: null, body: null, imageUrl: null, ctaLabel: null, ctaUrl: null, startsAt: null, endsAt: null, eventStartsAt: null, location: null, isFeatured: false, position: 10 }
const nullable = (value: string) => value.trim() || null
const toDateInput = (value: string | null) => value ? value.slice(0, 16) : ''
const toIso = (value: string) => value ? new Date(value).toISOString() : null

export function ContentPage() {
  const { api: auth } = useAuth(); const api = useMemo(() => auth, [auth]); const queryClient = useQueryClient()
  const [type, setType] = useState<'PROMOTION' | 'EVENT' | 'ARTICLE'>('PROMOTION'); const [selected, setSelected] = useState<ContentEntry | null>(null); const [draft, setDraft] = useState(empty)
  const entries = useQuery({ queryKey: ['admin', 'content', type], queryFn: () => api.request(`/api/admin/content?type=${type}`, contentEntryListResponseSchema) })
  const save = useMutation({ mutationFn: () => selected ? api.request(`/api/admin/content/${selected.id}`, contentEntryResponseSchema, { method: 'PUT', body: upsertContentEntryRequestSchema.parse(draft) }) : api.request('/api/admin/content', contentEntryResponseSchema, { method: 'POST', body: upsertContentEntryRequestSchema.parse(draft) }), onSuccess: ({ entry }) => { setSelected(entry); setDraft(toDraft(entry)); void queryClient.invalidateQueries({ queryKey: ['admin', 'content', type] }) } })
  function start(nextType: 'PROMOTION' | 'EVENT' | 'ARTICLE') { setType(nextType); setSelected(null); setDraft({ ...empty, type: nextType }) }
  function select(entry: ContentEntry) { setSelected(entry); setDraft(toDraft(entry)) }
  function change<K extends keyof UpsertContentEntryRequest>(key: K, value: UpsertContentEntryRequest[K]) { setDraft((current) => ({ ...current, [key]: value })) }
  return <section className="admin-page admin-content-workspace">
    <AdminPageHeader eyebrow="Публикация" title="Материалы" description="Акции, события и журнал для сайта. Работайте с одним типом контента за раз." actions={<Button onClick={() => start(type)} type="button">Новый материал</Button>} />
    <AdminTabs label="Тип материала" value={type} onChange={start} tabs={[{ value: 'PROMOTION', label: 'Акции' }, { value: 'EVENT', label: 'События' }, { value: 'ARTICLE', label: 'Журнал' }]} />
    <div className="grid gap-6 lg:grid-cols-[minmax(16rem,.62fr)_minmax(0,1.38fr)]">
      <Card className="admin-resource-list">
        <CardHeader><CardTitle>{type === 'PROMOTION' ? 'Акции' : type === 'EVENT' ? 'События' : 'Статьи'}</CardTitle><CardDescription>Выберите запись, чтобы отредактировать её.</CardDescription></CardHeader>
        <CardContent className="grid gap-2">
          {entries.isPending ? <p className="text-sm text-muted-foreground">Загружаем материалы…</p> : null}
          {entries.data?.entries.map((entry) => <button className="admin-list-row" data-selected={selected?.id === entry.id || undefined} key={entry.id} onClick={() => select(entry)} type="button"><span><b>{entry.title}</b><small>{statusLabel[entry.status]} · {entry.isFeatured ? 'на главной' : 'обычная'}</small></span></button>)}
          {entries.isError ? <p className="text-sm text-destructive">Не удалось загрузить материалы.</p> : null}
          {!entries.isPending && !entries.isError && entries.data?.entries.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Пока нет материалов этого типа.</p> : null}
        </CardContent>
      </Card>
      <Card className="admin-editor-card"><CardHeader><CardTitle>{selected ? 'Редактирование материала' : type === 'PROMOTION' ? 'Новая акция' : type === 'EVENT' ? 'Новое событие' : 'Новая статья'}</CardTitle><CardDescription>Черновик не отображается публично. Опубликуйте запись, когда карточка готова.</CardDescription></CardHeader><CardContent><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate() }}><div className="grid gap-4 sm:grid-cols-2"><Field label="Тип"><select value={draft.type} onChange={(event) => change('type', event.target.value as 'PROMOTION' | 'EVENT' | 'ARTICLE')}><option value="PROMOTION">Акция</option><option value="EVENT">Событие</option><option value="ARTICLE">Статья</option></select></Field><Field label="Статус"><select value={draft.status} onChange={(event) => change('status', event.target.value as UpsertContentEntryRequest['status'])}><option value="DRAFT">Черновик</option><option value="PUBLISHED">Опубликовано</option><option value="ARCHIVED">Архив</option></select></Field></div><Field label="Заголовок"><Input required value={draft.title} onChange={(event) => change('title', event.target.value)} /></Field><Field label="Адрес страницы"><Input required placeholder="latte-art" value={draft.slug} onChange={(event) => change('slug', event.target.value)} /></Field><Field label="Короткое описание"><Textarea value={draft.excerpt ?? ''} onChange={(event) => change('excerpt', nullable(event.target.value))} /></Field><Field label="Полный текст"><Textarea className="min-h-40" value={draft.body ?? ''} onChange={(event) => change('body', nullable(event.target.value))} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Изображение"><Input type="url" value={draft.imageUrl ?? ''} onChange={(event) => change('imageUrl', nullable(event.target.value))} /></Field><Field label="Порядок"><Input min={0} type="number" value={draft.position} onChange={(event) => change('position', Number(event.target.value))} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Начало показа"><Input type="datetime-local" value={toDateInput(draft.startsAt)} onChange={(event) => change('startsAt', toIso(event.target.value))} /></Field><Field label="Окончание показа"><Input type="datetime-local" value={toDateInput(draft.endsAt)} onChange={(event) => change('endsAt', toIso(event.target.value))} /></Field></div>{draft.type === 'EVENT' ? <div className="grid gap-4 sm:grid-cols-2"><Field label="Дата и время события"><Input type="datetime-local" value={toDateInput(draft.eventStartsAt)} onChange={(event) => change('eventStartsAt', toIso(event.target.value))} /></Field><Field label="Место"><Input value={draft.location ?? ''} onChange={(event) => change('location', nullable(event.target.value))} /></Field></div> : null}<div className="grid gap-4 sm:grid-cols-2"><Field label="Текст кнопки"><Input value={draft.ctaLabel ?? ''} onChange={(event) => change('ctaLabel', nullable(event.target.value))} /></Field><Field label="Ссылка кнопки"><Input type="url" value={draft.ctaUrl ?? ''} onChange={(event) => change('ctaUrl', nullable(event.target.value))} /></Field></div><label className="flex items-center gap-2 text-sm font-medium"><input checked={draft.isFeatured} type="checkbox" onChange={(event) => change('isFeatured', event.target.checked)} />Показывать на главной</label>{save.isError ? <p className="text-sm text-destructive">Не удалось сохранить запись. Проверьте поля и уникальность адреса.</p> : null}<Button disabled={save.isPending} size="lg" type="submit">{save.isPending ? 'Сохраняем…' : 'Сохранить'}</Button></form></CardContent></Card>
    </div>
  </section>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label> }
function toDraft(entry: ContentEntry): UpsertContentEntryRequest { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = entry; return draft }
const statusLabel = { DRAFT: 'Черновик', PUBLISHED: 'Опубликовано', ARCHIVED: 'Архив' }
