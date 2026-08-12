import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { managedPageKeySchema, managedPageListResponseSchema, managedPageResponseSchema, upsertManagedPageRequestSchema, type AppChoice, type CoffeeTaste, type ManagedPage, type ManagedPageImage, type ManagedPageKey, type UpsertManagedPageRequest } from '@chashka-coffee/contracts'
import { Link } from '@tanstack/react-router'

import { AdminDraftRecovery, AdminField, AdminFormIntro, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BlockEditor } from '@/features/content-admin'
import { useAuth } from '@/features/auth'
import { AdminImageField } from '@/features/media-admin'
import { resolveAdminImagePreview } from '@/features/media-admin/media-utils'
import { useEditorDraft } from '@/hooks/use-editor-draft'

const labels: Record<ManagedPageKey, string> = { HOME: 'Главная', COFFEE: 'Кофе', RESTAURANTS: 'Рестораны', DELIVERY: 'Доставка', APP: 'Приложение', LOYALTY: 'Лояльность', CERTIFICATES: 'Сертификаты', BAKERY: 'Кондитерская', FRANCHISE: 'Франшиза', JOBS: 'Вакансии', CONTACTS: 'Контакты', ABOUT: 'О нас', BANQUETS: 'Банкеты', PROMOTIONS: 'Акции' }

const heroDefaults: Partial<Record<ManagedPageKey, Pick<UpsertManagedPageRequest, 'heroTitle' | 'heroDescription' | 'heroImageUrl'>>> = {
  ABOUT: { heroTitle: 'Город меняется.\nЛюбимое место\ностаётся.', heroDescription: 'Мы создаём рестораны, в которых одинаково естественно начать утро, назначить важную встречу и задержаться без особого повода.', heroImageUrl: '/images/restaurants-hero.png' },
  COFFEE: { heroTitle: 'Кофе —\nнаша работа.', heroDescription: 'Выбираем зерно, строим профиль обжарки и каждый день настраиваем вкус в чашке.', heroImageUrl: '/images/coffee-editorial-v1.webp' },
  BAKERY: { heroTitle: 'Десерты\nс честным составом', heroDescription: 'Собираем торты и десерты вручную — из натуральных ингредиентов и заготовок собственного производства.', heroImageUrl: '/images/bakery-hero-v1.png' },
  DELIVERY: { heroTitle: 'Любимое\nприедет.', heroDescription: 'Для медленного утра, обеда между встречами или вечера, когда хочется остаться дома.', heroImageUrl: '/images/home-breakfast.png' },
  LOYALTY: { heroTitle: 'Любимое\nвозвращается', heroDescription: 'Показывайте электронную карту при каждом заказе — и часть стоимости вернётся бонусами на следующий визит.', heroImageUrl: '/images/home-morning-v2.png' },
  APP: { heroTitle: 'Вся «Чашка»\nв вашем телефоне', heroDescription: 'Заказывайте и оплачивайте онлайн, копите бонусы, возвращайтесь к любимым блюдам и узнавайте о новом раньше всех.', heroImageUrl: '/images/app/hero.webp' },
  CERTIFICATES: { heroTitle: 'Подарок,\nкоторый выбирают сами', heroDescription: 'Кофе утром, любимый десерт или долгий ужин — подарите повод прийти в «Чашку кофе» за своим моментом.', heroImageUrl: '/images/certificate-paper-a6.png' },
  FRANCHISE: { heroTitle: 'Открывайте\nместо, куда\nхочется вернуться', heroDescription: 'Не просто точку с кофе — живой ресторан с характером, понятной моделью и поддержкой на каждом шаге.', heroImageUrl: '/images/restaurants-hero.png' },
  JOBS: { heroTitle: 'Работа\nсо вкусом к людям', heroDescription: 'Ищем внимательных людей, которым важны гости, команда и хорошо сделанная работа.', heroImageUrl: '/images/home-hero-v1.png' },
  BANQUETS: { heroTitle: 'Соберём\nваш повод', heroDescription: 'Семейный праздник, важный ужин или встреча команды — выберите место, а мы поможем с деталями.', heroImageUrl: '/images/restaurants-hero.png' },
}

const pageImageDefaults: Partial<Record<ManagedPageKey, ManagedPageImage[]>> = {
  HOME: [{ id: 'menu-tile', label: 'Плитка «Завтраки»', imageUrl: '/images/home-breakfast.png', imageAlt: 'Завтраки' }],
  ABOUT: [{ id: 'craft', label: 'Блок «Зерно, кухня и кондитерская»', imageUrl: '/images/home-morning-v2.png', imageAlt: 'Кофе собственной обжарки' }],
  DELIVERY: [{ id: 'app-order-screen', label: 'Экран приложения в блоке заказа', imageUrl: '/images/app/order-screen.webp', imageAlt: 'Экран заказа в приложении Чашка кофе' }],
  JOBS: [{ id: 'team', label: 'Блок о команде', imageUrl: '/images/stock/jobs-team.jpg', imageAlt: 'Команда бариста за стойкой' }],
  BANQUETS: [{ id: 'gathering', label: 'История о событии', imageUrl: '/images/stock/banquets-gathering.jpg', imageAlt: 'Гости за праздничным столом' }],
  FRANCHISE: [{ id: 'roastery', label: 'Блок о собственной обжарке', imageUrl: '/images/stock/franchise-roastery.jpg', imageAlt: 'Обжарка кофе Чашки кофе' }],
}

const mergedPageImages = (key: ManagedPageKey, saved: ManagedPageImage[] | undefined) => (pageImageDefaults[key] ?? []).map((fallback) => saved?.find((image) => image.id === fallback.id) ?? fallback)

const defaultCoffeeTastes: CoffeeTaste[] = [
  { title: 'Абрикос', description: 'сочная сладость и мягкая кислотность', imageUrl: '/images/coffee-taste-apricot-v1.webp' },
  { title: 'Шоколад', description: 'плотность, какао и долгий тёплый шлейф', imageUrl: '/images/coffee-taste-chocolate-v1.webp' },
  { title: 'Персик', description: 'бархатистый аромат и лёгкая свежесть', imageUrl: '/images/coffee-taste-peach-v1.webp' },
  { title: 'Вишня', description: 'ягодная сочность и винная кислинка', imageUrl: '/images/coffee-taste-cherry-v1.webp' },
  { title: 'Апельсин', description: 'яркий цитрус, цедра и чистая свежесть', imageUrl: '/images/coffee-taste-orange-v1.webp' },
  { title: 'Карамель', description: 'тягучая сладость и округлый тёплый вкус', imageUrl: '/images/coffee-taste-caramel-v1.webp' },
  { title: 'Фундук', description: 'жареный орех и мягкое сливочное послевкусие', imageUrl: '/images/coffee-taste-hazelnut-v1.webp' },
]

const defaultAppChoices: AppChoice[] = [
  {
    id: '018f8d94-1f4f-7000-8000-000000000101',
    label: 'Заказать',
    title: 'Выбрать ресторан и заказать',
    description: 'Доставка или самовывоз, актуальное меню и ближайшая «Чашка» — всё начинается с одного экрана.',
    imageUrl: '/images/app/order-screen.webp',
    imageAlt: 'Главный экран приложения Чашка кофе с выбором доставки, самовывоза и ресторана',
  },
  {
    id: '018f8d94-1f4f-7000-8000-000000000102',
    label: 'Открыть карту',
    title: 'Показать карту и получить бонусы',
    description: 'QR-карта всегда под рукой: откройте её перед оплатой, чтобы копить и использовать бонусы.',
    imageUrl: '/images/app/bonus-card.webp',
    imageAlt: 'Экран бонусной QR-карты в приложении Чашка кофе',
  },
]

function pageDraft(key: ManagedPageKey, page?: ManagedPage): UpsertManagedPageRequest {
  const hero = heroDefaults[key] ?? { heroTitle: null, heroDescription: null, heroImageUrl: null }
  return {
    key,
    title: page?.title ?? labels[key],
    heroTitle: page?.heroTitle ?? hero.heroTitle,
    heroDescription: page?.heroDescription ?? hero.heroDescription,
    heroImageUrl: page?.heroImageUrl ?? hero.heroImageUrl,
    coffeeTastes: key === 'COFFEE' ? page?.coffeeTastes ?? defaultCoffeeTastes : null,
    appChoices: key === 'APP' ? page?.appChoices ?? defaultAppChoices : null,
    images: mergedPageImages(key, page?.images),
    blocks: page?.blocks ?? [],
  }
}

export function ManagedPagesPage({ mode = 'list', pageKey }: { mode?: 'list' | 'edit'; pageKey?: string }) {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const parsedKey = pageKey ? managedPageKeySchema.safeParse(pageKey).data : undefined
  const pages = useQuery({ queryKey: ['admin', 'pages'], queryFn: () => api.request('/api/admin/pages', managedPageListResponseSchema) })
  const selected = parsedKey ? pages.data?.pages.find((item) => item.key === parsedKey) : undefined
  const editor = useEditorDraft<UpsertManagedPageRequest>({ key: `page:${parsedKey ?? 'unknown'}`, initialValue: pageDraft(parsedKey ?? 'ABOUT', selected), sourceVersion: selected?.updatedAt ?? (parsedKey ? 'base' : 'loading'), enabled: mode === 'edit' && Boolean(parsedKey) })
  const { draft, setDraft } = editor

  const save = useMutation({
    mutationFn: () => api.request(`/api/admin/pages/${parsedKey}`, managedPageResponseSchema, { method: 'PUT', body: upsertManagedPageRequestSchema.parse(draft) }),
    onSuccess: ({ page }) => { const savedDraft = pageDraft(page.key, page); editor.markSaved(savedDraft); setDraft(savedDraft); void queryClient.invalidateQueries({ queryKey: ['admin', 'pages'] }) },
  })

  if (mode === 'list') return <section className="admin-page admin-content-workspace">
    <AdminPageHeader eyebrow="Страницы" title="Содержание разделов" description="Выберите страницу, чтобы изменить её тексты, изображения и смысловые блоки." />
    <Card><CardHeader><CardTitle>Разделы сайта</CardTitle><CardDescription>Вёрстка страниц защищена от случайных изменений — здесь редактируется только содержание.</CardDescription></CardHeader><CardContent className="admin-directory-list">
      {managedPageKeySchema.options.map((key) => {
        const configured = pages.data?.pages.some((item) => item.key === key)
        return <Link className="admin-directory-row admin-directory-row-simple" key={key} to="/pages/$pageKey" params={{ pageKey: key }}>
          <span className="admin-directory-main"><strong>{labels[key]}</strong><small>{configured ? 'Есть индивидуальные настройки' : 'Сейчас используется базовое содержание'}</small></span>
          <span className={configured ? 'admin-status-pill' : 'admin-status-pill admin-status-muted'}>{configured ? 'Настроена' : 'Базовая'}</span>
          <span className="admin-row-action">Открыть</span>
        </Link>
      })}
      {pages.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить страницы.</p> : null}
    </CardContent></Card>
  </section>

  if (!parsedKey) return <section className="admin-page"><AdminPageHeader eyebrow="Страницы" title="Страница не найдена" description="Ссылка содержит неизвестный раздел." actions={<Button asChild variant="outline"><Link to="/pages">К списку страниц</Link></Button>} /></section>
  if (pages.isPending) return <section className="admin-page"><p className="admin-state-message">Загружаем страницу…</p></section>

  return <section className="admin-page admin-content-workspace admin-page-editor">
    <AdminPageHeader eyebrow="Страницы" title={labels[parsedKey]} description="Изменяйте блоки сверху вниз — в том же порядке они появляются на сайте." actions={<Button asChild variant="outline"><Link to="/pages">К списку страниц</Link></Button>} />
    {editor.recovery ? <AdminDraftRecovery savedAt={editor.recovery.savedAt} onRestore={editor.restore} onDiscard={editor.discardRecovery} /> : null}
    <Card className="admin-editor-surface"><CardHeader><CardTitle>Содержание страницы</CardTitle><CardDescription>Скрытые блоки сохраняются в редакторе, но не показываются посетителям.</CardDescription></CardHeader><CardContent>
      <form className="admin-form-stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
        <AdminFormIntro>Первый экран и смысловые блоки сохраняются отдельно: изменение текста не затрагивает композицию страницы.</AdminFormIntro>
        <AdminField label="Название раздела" required hint="Используется в админке и метаданных страницы"><Input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></AdminField>
        {heroDefaults[parsedKey] ? <section className="admin-form-subsection admin-form-stack">
          <div><h3 className="admin-field-heading">Первый экран</h3><p className="admin-field-hint">Изображение, заголовок и описание меняются без перестройки вёрстки.</p></div>
          <AdminField label="Изображение" required hint="Выберите готовую фотографию или загрузите и кадрируйте новую."><AdminImageField required value={draft.heroImageUrl ?? null} onChange={(heroImageUrl) => setDraft((current) => ({ ...current, heroImageUrl }))} /></AdminField>
          <AdminField label="Заголовок" required hint="Переносы строк сохраняются"><Textarea required value={draft.heroTitle ?? ''} onChange={(event) => setDraft((current) => ({ ...current, heroTitle: event.target.value || null }))} /></AdminField>
          <AdminField label="Описание" required><Textarea required value={draft.heroDescription ?? ''} onChange={(event) => setDraft((current) => ({ ...current, heroDescription: event.target.value || null }))} /></AdminField>
        </section> : null}
        {parsedKey === 'COFFEE' ? <CoffeeTasteEditor tastes={draft.coffeeTastes ?? defaultCoffeeTastes} onChange={(coffeeTastes) => setDraft((current) => ({ ...current, coffeeTastes }))} /> : null}
        {parsedKey === 'APP' ? <AppChoiceEditor choices={draft.appChoices ?? defaultAppChoices} onChange={(appChoices) => setDraft((current) => ({ ...current, appChoices }))} /> : null}
        {draft.images?.length ? <section className="admin-form-subsection admin-form-stack">
          <div><h3 className="admin-field-heading">Фотографии секций</h3><p className="admin-field-hint">Кадры из постоянных блоков этой страницы. SVG-иллюстрации сюда не входят.</p></div>
          {draft.images.map((image, index) => <AdminField key={image.id} label={image.label}><AdminImageField required value={image.imageUrl} onChange={(imageUrl) => imageUrl && setDraft((current) => ({ ...current, images: current.images?.map((item, itemIndex) => itemIndex === index ? { ...item, imageUrl } : item) }))} /><Input aria-label={`Описание: ${image.label}`} placeholder="Описание фотографии" value={image.imageAlt} onChange={(event) => setDraft((current) => ({ ...current, images: current.images?.map((item, itemIndex) => itemIndex === index ? { ...item, imageAlt: event.target.value } : item) }))} /></AdminField>)}
        </section> : null}
        <BlockEditor blocks={draft.blocks} onChange={(blocks) => setDraft((current) => ({ ...current, blocks }))} />
        {save.isError ? <p className="admin-state-message admin-state-error">Не удалось сохранить страницу. Проверьте обязательные поля блоков.</p> : null}
        <div className="admin-form-actions"><Button disabled={save.isPending} size="lg" type="submit">{save.isPending ? 'Сохраняем…' : 'Сохранить страницу'}</Button><Button asChild variant="outline"><Link to="/pages">Отмена</Link></Button></div>
      </form>
    </CardContent></Card>
  </section>
}

function AppChoiceEditor({ choices, onChange }: { choices: AppChoice[]; onChange: (choices: AppChoice[]) => void }) {
  const update = (index: number, next: AppChoice) => onChange(choices.map((choice, choiceIndex) => choiceIndex === index ? next : choice))
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= choices.length) return
    const next = [...choices]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return <section className="admin-form-subsection admin-form-stack">
    <div><h3 className="admin-field-heading">Блок «Что сегодня важнее?»</h3><p className="admin-field-hint">Пункты переключаются слева направо. Для каждого задайте подпись вкладки, пояснение и экран приложения внутри телефона.</p></div>
    <div className="admin-gallery-images">
      {choices.map((choice, index) => <section className="admin-gallery-image" key={choice.id}>
        <div className="admin-gallery-preview">{choice.imageUrl ? <img alt="" src={resolveAdminImagePreview(choice.imageUrl)} /> : <span>Нет изображения</span>}<b>{index + 1}</b></div>
        <div className="admin-gallery-image-fields">
          <AdminField label="Название вкладки" required><Input required value={choice.label} onChange={(event) => update(index, { ...choice, label: event.target.value })} /></AdminField>
          <AdminField label="Заголовок" required><Input required value={choice.title} onChange={(event) => update(index, { ...choice, title: event.target.value })} /></AdminField>
          <AdminField label="Описание" required><Textarea required value={choice.description} onChange={(event) => update(index, { ...choice, description: event.target.value })} /></AdminField>
          <AdminField label="Скриншот" required hint="Выберите готовое изображение или загрузите новое."><AdminImageField compact required value={choice.imageUrl} onChange={(imageUrl) => imageUrl && update(index, { ...choice, imageUrl })} /></AdminField>
          <AdminField label="Описание изображения" required hint="Коротко опишите, что видно на экране"><Input required value={choice.imageAlt} onChange={(event) => update(index, { ...choice, imageAlt: event.target.value })} /></AdminField>
        </div>
        <div className="admin-gallery-image-actions">
          <Button aria-label="Переместить пункт выше" disabled={index === 0} size="sm" type="button" variant="ghost" onClick={() => move(index, -1)}>↑</Button>
          <Button aria-label="Переместить пункт ниже" disabled={index === choices.length - 1} size="sm" type="button" variant="ghost" onClick={() => move(index, 1)}>↓</Button>
          <Button disabled={choices.length === 1} size="sm" type="button" variant="ghost" onClick={() => onChange(choices.filter((_, choiceIndex) => choiceIndex !== index))}>Удалить</Button>
        </div>
      </section>)}
    </div>
    <Button disabled={choices.length >= 6} type="button" variant="outline" onClick={() => onChange([...choices, {
      id: crypto.randomUUID(),
      label: 'Новый пункт',
      title: 'Заголовок сценария',
      description: 'Коротко объясните, что пользователь может сделать на этом экране.',
      imageUrl: '/images/app/order-screen.webp',
      imageAlt: 'Экран приложения Чашка кофе',
    }])}>Добавить пункт</Button>
  </section>
}

function CoffeeTasteEditor({ tastes, onChange }: { tastes: CoffeeTaste[]; onChange: (tastes: CoffeeTaste[]) => void }) {
  const update = (index: number, next: CoffeeTaste) => onChange(tastes.map((taste, tasteIndex) => tasteIndex === index ? next : taste))
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= tastes.length) return
    const next = [...tastes]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return <section className="admin-form-subsection admin-form-stack">
    <div><h3 className="admin-field-heading">Аккордеон вкусов</h3><p className="admin-field-hint">Каждый вкус содержит фотографию, заголовок и подпись под ним.</p></div>
    <div className="admin-gallery-images">
      {tastes.map((taste, index) => <section className="admin-gallery-image" key={`${taste.title}-${index}`}>
        <div className="admin-gallery-preview">{taste.imageUrl ? <img alt="" src={resolveAdminImagePreview(taste.imageUrl)} /> : <span>Нет изображения</span>}<b>{index + 1}</b></div>
        <div className="admin-gallery-image-fields">
          <AdminField label="Заголовок" required><Input required value={taste.title} onChange={(event) => update(index, { ...taste, title: event.target.value })} /></AdminField>
          <AdminField label="Описание" required><Input required value={taste.description} onChange={(event) => update(index, { ...taste, description: event.target.value })} /></AdminField>
          <AdminField label="Изображение" required><AdminImageField compact required value={taste.imageUrl} onChange={(imageUrl) => imageUrl && update(index, { ...taste, imageUrl })} /></AdminField>
        </div>
        <div className="admin-gallery-image-actions">
          <Button aria-label="Переместить вкус выше" disabled={index === 0} size="sm" type="button" variant="ghost" onClick={() => move(index, -1)}>↑</Button>
          <Button aria-label="Переместить вкус ниже" disabled={index === tastes.length - 1} size="sm" type="button" variant="ghost" onClick={() => move(index, 1)}>↓</Button>
          <Button disabled={tastes.length === 1} size="sm" type="button" variant="ghost" onClick={() => onChange(tastes.filter((_, tasteIndex) => tasteIndex !== index))}>Удалить</Button>
        </div>
      </section>)}
    </div>
    <Button disabled={tastes.length >= 12} type="button" variant="outline" onClick={() => onChange([...tastes, { title: 'Новый вкус', description: 'Короткое описание вкуса', imageUrl: '/images/coffee-taste-apricot-v1.webp' }])}>Добавить вкус</Button>
  </section>
}
