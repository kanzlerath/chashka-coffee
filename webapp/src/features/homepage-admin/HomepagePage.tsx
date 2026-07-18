import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  homepageAdminResponseSchema,
  homepageBestsellerResponseSchema,
  homepageDayPartResponseSchema,
  homepageDaySectionResponseSchema,
  homepageOperationSuccessResponseSchema,
  homepageSlideResponseSchema,
  upsertHomepageBestsellerRequestSchema,
  upsertHomepageDayPartRequestSchema,
  upsertHomepageDaySectionRequestSchema,
  upsertHomepageSlideRequestSchema,
  type HomepageBestseller,
  type HomepageDayPart,
  type HomepageDaySection,
  type HomepageSlide,
  type UpsertHomepageBestsellerRequest,
  type UpsertHomepageDayPartRequest,
  type UpsertHomepageDaySectionRequest,
  type UpsertHomepageSlideRequest,
} from '@chashka-coffee/contracts'
import { useEffect, useMemo, useState } from 'react'

import { AdminPageHeader, AdminTabs } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'

const emptySlide: UpsertHomepageSlideRequest = {
  mediaType: 'IMAGE', mediaUrl: '', posterUrl: null, eyebrow: null, title: '', description: null,
  ctaLabel: null, ctaUrl: null, durationSeconds: 7, isPublished: false, position: 10,
}
const emptyBestseller: UpsertHomepageBestsellerRequest = { menuItemId: '', badge: null, position: 10, isPublished: true }
const emptyDaySection: UpsertHomepageDaySectionRequest = { title: 'Поводы зайти сегодня', description: null, isPublished: true }
const emptyDayPart = (sectionId = ''): UpsertHomepageDayPartRequest => ({ sectionId, label: '', title: '', description: null, ctaUrl: null, position: 10, isPublished: true })
const nullable = (value: string) => value.trim() || null

export function HomepagePage() {
  const { api: auth } = useAuth()
  const api = useMemo(() => auth, [auth])
  const queryClient = useQueryClient()
  const [slide, setSlide] = useState<HomepageSlide | null>(null)
  const [slideDraft, setSlideDraft] = useState<UpsertHomepageSlideRequest>(emptySlide)
  const [bestseller, setBestseller] = useState<HomepageBestseller | null>(null)
  const [bestsellerDraft, setBestsellerDraft] = useState<UpsertHomepageBestsellerRequest>(emptyBestseller)
  const [daySection, setDaySection] = useState<HomepageDaySection | null>(null)
  const [daySectionDraft, setDaySectionDraft] = useState<UpsertHomepageDaySectionRequest>(emptyDaySection)
  const [dayPart, setDayPart] = useState<HomepageDayPart | null>(null)
  const [dayPartDraft, setDayPartDraft] = useState<UpsertHomepageDayPartRequest>(emptyDayPart())
  const [panel, setPanel] = useState<'slides' | 'bestsellers' | 'day'>('slides')
  const homepage = useQuery({ queryKey: ['admin', 'homepage'], queryFn: () => api.request('/api/admin/homepage', homepageAdminResponseSchema) })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'homepage'] })

  useEffect(() => {
    if (!homepage.data?.daySection || daySection?.id === homepage.data.daySection.id) return
    setDaySection(homepage.data.daySection)
    setDaySectionDraft(toDaySectionDraft(homepage.data.daySection))
    setDayPartDraft(emptyDayPart(homepage.data.daySection.id))
  }, [daySection?.id, homepage.data?.daySection])

  const saveSlide = useMutation({
    mutationFn: () => slide
      ? api.request(`/api/admin/homepage/slides/${slide.id}`, homepageSlideResponseSchema, { method: 'PUT', body: upsertHomepageSlideRequestSchema.parse(slideDraft) })
      : api.request('/api/admin/homepage/slides', homepageSlideResponseSchema, { method: 'POST', body: upsertHomepageSlideRequestSchema.parse(slideDraft) }),
    onSuccess: ({ slide: saved }) => { setSlide(saved); setSlideDraft(toSlideDraft(saved)); refresh() },
  })
  const removeSlide = useMutation({
    mutationFn: (id: string) => api.request(`/api/admin/homepage/slides/${id}`, homepageOperationSuccessResponseSchema, { method: 'DELETE' }),
    onSuccess: () => { setSlide(null); setSlideDraft(emptySlide); refresh() },
  })
  const saveBestseller = useMutation({
    mutationFn: () => bestseller
      ? api.request(`/api/admin/homepage/bestsellers/${bestseller.id}`, homepageBestsellerResponseSchema, { method: 'PUT', body: upsertHomepageBestsellerRequestSchema.parse(bestsellerDraft) })
      : api.request('/api/admin/homepage/bestsellers', homepageBestsellerResponseSchema, { method: 'POST', body: upsertHomepageBestsellerRequestSchema.parse(bestsellerDraft) }),
    onSuccess: ({ bestseller: saved }) => { setBestseller(saved); setBestsellerDraft(toBestsellerDraft(saved)); refresh() },
  })
  const removeBestseller = useMutation({
    mutationFn: (id: string) => api.request(`/api/admin/homepage/bestsellers/${id}`, homepageOperationSuccessResponseSchema, { method: 'DELETE' }),
    onSuccess: () => { setBestseller(null); setBestsellerDraft(emptyBestseller); refresh() },
  })
  const saveDaySection = useMutation({
    mutationFn: () => daySection
      ? api.request(`/api/admin/homepage/day-section/${daySection.id}`, homepageDaySectionResponseSchema, { method: 'PUT', body: upsertHomepageDaySectionRequestSchema.parse(daySectionDraft) })
      : api.request('/api/admin/homepage/day-section', homepageDaySectionResponseSchema, { method: 'POST', body: upsertHomepageDaySectionRequestSchema.parse(daySectionDraft) }),
    onSuccess: ({ daySection: saved }) => { setDaySection(saved); setDaySectionDraft(toDaySectionDraft(saved)); setDayPartDraft(emptyDayPart(saved.id)); refresh() },
  })
  const saveDayPart = useMutation({
    mutationFn: () => dayPart
      ? api.request(`/api/admin/homepage/day-parts/${dayPart.id}`, homepageDayPartResponseSchema, { method: 'PUT', body: upsertHomepageDayPartRequestSchema.parse(dayPartDraft) })
      : api.request('/api/admin/homepage/day-parts', homepageDayPartResponseSchema, { method: 'POST', body: upsertHomepageDayPartRequestSchema.parse(dayPartDraft) }),
    onSuccess: ({ dayPart: saved }) => { setDayPart(saved); setDayPartDraft(toDayPartDraft(saved)); refresh() },
  })
  const removeDayPart = useMutation({
    mutationFn: (id: string) => api.request(`/api/admin/homepage/day-parts/${id}`, homepageOperationSuccessResponseSchema, { method: 'DELETE' }),
    onSuccess: () => { setDayPart(null); setDayPartDraft(emptyDayPart(daySection?.id)); refresh() },
  })

  return <section className="admin-page admin-homepage-workspace">
    <AdminPageHeader eyebrow="Публикация" title="Главная страница" description="Настраивайте сценарии первого экрана, подборку бестселлеров и блок с поводами зайти." />
    <AdminTabs label="Раздел главной страницы" value={panel} onChange={setPanel} tabs={[{ value: 'slides', label: 'Первый экран' }, { value: 'bestsellers', label: 'Бестселлеры' }, { value: 'day', label: 'Поводы зайти' }]} />
    <div className="admin-homepage-panel">
    {panel === 'slides' ? <Card>
      <CardHeader><CardTitle>Галерея первого экрана</CardTitle><CardDescription>Слайды идут по порядку. Видео воспроизводится без звука и использует постер до загрузки.</CardDescription></CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">{homepage.data?.slides.map((entry) => <button className="flex items-center justify-between rounded-xl border p-3 text-left hover:bg-muted" key={entry.id} onClick={() => { setSlide(entry); setSlideDraft(toSlideDraft(entry)) }} type="button"><span><b className="block">{entry.title}</b><small className="text-muted-foreground">{entry.mediaType === 'VIDEO' ? 'Видео' : 'Изображение'} · {entry.isPublished ? 'опубликован' : 'черновик'}</small></span><span className="text-muted-foreground">{entry.position}</span></button>)}</div>
        <Button onClick={() => { setSlide(null); setSlideDraft({ ...emptySlide, position: (homepage.data?.slides.length ?? 0) * 10 + 10 }) }} type="button" variant="outline">Новый слайд</Button>
        <SlideForm draft={slideDraft} onChange={setSlideDraft} onRemove={slide ? () => removeSlide.mutate(slide.id) : undefined} onSave={() => saveSlide.mutate()} saving={saveSlide.isPending} deleting={removeSlide.isPending} error={saveSlide.isError} />
      </CardContent>
    </Card> : null}

    {panel === 'bestsellers' ? <Card>
      <CardHeader><CardTitle>Бестселлеры</CardTitle><CardDescription>Выберите реальные позиции меню. Их название, цена и фотография на главной всегда совпадают с каталогом.</CardDescription></CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">{homepage.data?.bestsellers.map((entry) => <button className="flex items-center justify-between rounded-xl border p-3 text-left hover:bg-muted" key={entry.id} onClick={() => { setBestseller(entry); setBestsellerDraft(toBestsellerDraft(entry)) }} type="button"><span><b className="block">{entry.item.name}</b><small className="text-muted-foreground">{entry.badge ?? entry.item.marketingBadge ?? entry.item.categoryName} · {entry.isPublished ? 'опубликован' : 'черновик'}</small></span><span className="text-muted-foreground">{entry.position}</span></button>)}</div>
        <Button onClick={() => { setBestseller(null); setBestsellerDraft({ ...emptyBestseller, position: (homepage.data?.bestsellers.length ?? 0) * 10 + 10 }) }} type="button" variant="outline">Добавить позицию</Button>
        <BestsellerForm menuItems={homepage.data?.menuItems ?? []} draft={bestsellerDraft} onChange={setBestsellerDraft} onRemove={bestseller ? () => removeBestseller.mutate(bestseller.id) : undefined} onSave={() => saveBestseller.mutate()} saving={saveBestseller.isPending} deleting={removeBestseller.isPending} error={saveBestseller.isError} />
      </CardContent>
    </Card> : null}

    {panel === 'day' ? <Card>
      <CardHeader><CardTitle>Поводы зайти сегодня</CardTitle><CardDescription>Настройте заголовок блока и три периода дня. Каждая строка ведёт на выбранную страницу сайта.</CardDescription></CardHeader>
      <CardContent className="grid gap-5">
        <DaySectionForm draft={daySectionDraft} onChange={setDaySectionDraft} onSave={() => saveDaySection.mutate()} saving={saveDaySection.isPending} error={saveDaySection.isError} />
        {daySection ? <><div className="grid gap-2 border-t pt-5">{daySection.parts.map((entry) => <button className="flex items-center justify-between rounded-xl border p-3 text-left hover:bg-muted" key={entry.id} onClick={() => { setDayPart(entry); setDayPartDraft(toDayPartDraft(entry)) }} type="button"><span><b className="block">{entry.label} · {entry.title}</b><small className="text-muted-foreground">{entry.isPublished ? 'опубликован' : 'черновик'} · {entry.ctaUrl ?? 'без ссылки'}</small></span><span className="text-muted-foreground">{entry.position}</span></button>)}</div><Button onClick={() => { setDayPart(null); setDayPartDraft({ ...emptyDayPart(daySection.id), position: (daySection.parts.length ?? 0) * 10 + 10 }) }} type="button" variant="outline">Добавить период дня</Button><DayPartForm draft={dayPartDraft} onChange={setDayPartDraft} onRemove={dayPart ? () => removeDayPart.mutate(dayPart.id) : undefined} onSave={() => saveDayPart.mutate()} saving={saveDayPart.isPending} deleting={removeDayPart.isPending} error={saveDayPart.isError} /></> : <p className="text-sm text-muted-foreground">Сначала сохраните заголовок блока, затем добавьте периоды дня.</p>}
      </CardContent>
    </Card> : null}
    </div>
  </section>
}

function SlideForm({ draft, onChange, onSave, onRemove, saving, deleting, error }: { draft: UpsertHomepageSlideRequest; onChange: (value: UpsertHomepageSlideRequest) => void; onSave: () => void; onRemove?: () => void; saving: boolean; deleting: boolean; error: boolean }) {
  const change = <K extends keyof UpsertHomepageSlideRequest>(key: K, value: UpsertHomepageSlideRequest[K]) => onChange({ ...draft, [key]: value })
  return <form className="grid gap-3 border-t pt-5" onSubmit={(event) => { event.preventDefault(); onSave() }}>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Тип"><select value={draft.mediaType} onChange={(event) => change('mediaType', event.target.value as UpsertHomepageSlideRequest['mediaType'])}><option value="IMAGE">Изображение</option><option value="VIDEO">Видео</option></select></Field><Field label="Порядок"><Input min={0} onChange={(event) => change('position', Number(event.target.value))} type="number" value={draft.position} /></Field></div>
    <Field label={draft.mediaType === 'VIDEO' ? 'URL видео' : 'URL изображения'}><Input onChange={(event) => change('mediaUrl', event.target.value)} placeholder="/images/hero.jpg или https://…" required value={draft.mediaUrl} /></Field>
    {draft.mediaType === 'VIDEO' ? <Field label="Постер для видео"><Input onChange={(event) => change('posterUrl', nullable(event.target.value))} placeholder="/images/poster.jpg" value={draft.posterUrl ?? ''} /></Field> : null}
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Над заголовком"><Input onChange={(event) => change('eyebrow', nullable(event.target.value))} value={draft.eyebrow ?? ''} /></Field><Field label="Секунды на слайд"><Input max={30} min={3} onChange={(event) => change('durationSeconds', Number(event.target.value))} type="number" value={draft.durationSeconds} /></Field></div>
    <Field label="Заголовок"><Input onChange={(event) => change('title', event.target.value)} required value={draft.title} /></Field>
    <Field label="Короткое описание"><Textarea onChange={(event) => change('description', nullable(event.target.value))} value={draft.description ?? ''} /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Текст кнопки"><Input onChange={(event) => change('ctaLabel', nullable(event.target.value))} value={draft.ctaLabel ?? ''} /></Field><Field label="Ссылка кнопки"><Input onChange={(event) => change('ctaUrl', nullable(event.target.value))} placeholder="/restaurants" value={draft.ctaUrl ?? ''} /></Field></div>
    <label className="flex items-center gap-2 text-sm font-medium"><input checked={draft.isPublished} onChange={(event) => change('isPublished', event.target.checked)} type="checkbox" />Показывать на сайте</label>
    {error ? <p className="text-sm text-destructive">Не удалось сохранить слайд. Проверьте ссылку и обязательные поля.</p> : null}
    <div className="flex flex-wrap gap-2"><Button disabled={saving} type="submit">{saving ? 'Сохраняем…' : 'Сохранить слайд'}</Button>{onRemove ? <Button disabled={deleting} onClick={onRemove} type="button" variant="outline">Удалить</Button> : null}</div>
  </form>
}

function BestsellerForm({ menuItems, draft, onChange, onSave, onRemove, saving, deleting, error }: { menuItems: HomepageBestseller['item'][]; draft: UpsertHomepageBestsellerRequest; onChange: (value: UpsertHomepageBestsellerRequest) => void; onSave: () => void; onRemove?: () => void; saving: boolean; deleting: boolean; error: boolean }) {
  const change = <K extends keyof UpsertHomepageBestsellerRequest>(key: K, value: UpsertHomepageBestsellerRequest[K]) => onChange({ ...draft, [key]: value })
  return <form className="grid gap-3 border-t pt-5" onSubmit={(event) => { event.preventDefault(); onSave() }}>
    <Field label="Позиция меню"><select onChange={(event) => change('menuItemId', event.target.value)} required value={draft.menuItemId}><option value="">Выберите позицию</option>{menuItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.categoryName}</option>)}</select></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Бейдж на главной"><Input onChange={(event) => change('badge', nullable(event.target.value))} placeholder="Хит" value={draft.badge ?? ''} /></Field><Field label="Порядок"><Input min={0} onChange={(event) => change('position', Number(event.target.value))} type="number" value={draft.position} /></Field></div>
    <label className="flex items-center gap-2 text-sm font-medium"><input checked={draft.isPublished} onChange={(event) => change('isPublished', event.target.checked)} type="checkbox" />Показывать на сайте</label>
    {error ? <p className="text-sm text-destructive">Не удалось сохранить позицию. Возможно, она уже добавлена в подборку.</p> : null}
    <div className="flex flex-wrap gap-2"><Button disabled={saving} type="submit">{saving ? 'Сохраняем…' : 'Сохранить позицию'}</Button>{onRemove ? <Button disabled={deleting} onClick={onRemove} type="button" variant="outline">Удалить</Button> : null}</div>
  </form>
}

function DaySectionForm({ draft, onChange, onSave, saving, error }: { draft: UpsertHomepageDaySectionRequest; onChange: (value: UpsertHomepageDaySectionRequest) => void; onSave: () => void; saving: boolean; error: boolean }) {
  const change = <K extends keyof UpsertHomepageDaySectionRequest>(key: K, value: UpsertHomepageDaySectionRequest[K]) => onChange({ ...draft, [key]: value })
  return <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); onSave() }}>
    <Field label="Заголовок слева"><Input onChange={(event) => change('title', event.target.value)} required value={draft.title} /></Field>
    <Field label="Описание слева"><Textarea onChange={(event) => change('description', nullable(event.target.value))} value={draft.description ?? ''} /></Field>
    <label className="flex items-center gap-2 text-sm font-medium"><input checked={draft.isPublished} onChange={(event) => change('isPublished', event.target.checked)} type="checkbox" />Показывать на сайте</label>
    {error ? <p className="text-sm text-destructive">Не удалось сохранить блок. Проверьте обязательные поля.</p> : null}
    <div><Button disabled={saving} type="submit">{saving ? 'Сохраняем…' : 'Сохранить блок'}</Button></div>
  </form>
}

function DayPartForm({ draft, onChange, onSave, onRemove, saving, deleting, error }: { draft: UpsertHomepageDayPartRequest; onChange: (value: UpsertHomepageDayPartRequest) => void; onSave: () => void; onRemove?: () => void; saving: boolean; deleting: boolean; error: boolean }) {
  const change = <K extends keyof UpsertHomepageDayPartRequest>(key: K, value: UpsertHomepageDayPartRequest[K]) => onChange({ ...draft, [key]: value })
  return <form className="grid gap-3 border-t pt-5" onSubmit={(event) => { event.preventDefault(); onSave() }}>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Метка"><Input onChange={(event) => change('label', event.target.value)} placeholder="Утро" required value={draft.label} /></Field><Field label="Порядок"><Input min={0} onChange={(event) => change('position', Number(event.target.value))} type="number" value={draft.position} /></Field></div>
    <Field label="Заголовок"><Input onChange={(event) => change('title', event.target.value)} placeholder="Завтраки до 12:00" required value={draft.title} /></Field>
    <Field label="Короткое описание"><Textarea onChange={(event) => change('description', nullable(event.target.value))} value={draft.description ?? ''} /></Field>
    <Field label="Ссылка"><Input onChange={(event) => change('ctaUrl', nullable(event.target.value))} placeholder="/restaurants/krasny-prospekt/menu" value={draft.ctaUrl ?? ''} /></Field>
    <label className="flex items-center gap-2 text-sm font-medium"><input checked={draft.isPublished} onChange={(event) => change('isPublished', event.target.checked)} type="checkbox" />Показывать на сайте</label>
    {error ? <p className="text-sm text-destructive">Не удалось сохранить период дня. Проверьте обязательные поля.</p> : null}
    <div className="flex flex-wrap gap-2"><Button disabled={saving} type="submit">{saving ? 'Сохраняем…' : 'Сохранить период'}</Button>{onRemove ? <Button disabled={deleting} onClick={onRemove} type="button" variant="outline">Удалить</Button> : null}</div>
  </form>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label> }
function toSlideDraft(entry: HomepageSlide): UpsertHomepageSlideRequest { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = entry; return draft }
function toBestsellerDraft(entry: HomepageBestseller): UpsertHomepageBestsellerRequest { const { id: _id, item: _item, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = entry; return draft }
function toDaySectionDraft(entry: HomepageDaySection | null): UpsertHomepageDaySectionRequest { if (!entry) return emptyDaySection; const { id: _id, parts: _parts, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = entry; return draft }
function toDayPartDraft(entry: HomepageDayPart): UpsertHomepageDayPartRequest { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = entry; return draft }
