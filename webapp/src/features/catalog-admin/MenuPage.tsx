import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminMenuDetailResponse,
  MarketingBadge,
  UpsertMenuCategoryRequest,
  UpsertMenuItemRequest,
  UpsertMenuRequest,
} from '@chashka-coffee/contracts'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import { CatalogAdminApi } from './api'

const emptyMenu: UpsertMenuRequest = { slug: '', name: '', description: null }
const emptyCategory: UpsertMenuCategoryRequest = { slug: '', name: '', position: 10 }
const emptyItem: UpsertMenuItemRequest = {
  slug: '', name: '', description: null, ingredients: null, weightGrams: null, priceKopecks: 0,
  calories: null, proteins: null, fats: null, carbohydrates: null,
  isVegetarian: false, isSpicy: false, isLactoseFree: false, isGlutenFree: false, isLight: false,
  marketingBadge: null, imageUrl: null, position: 10,
}

type MenuItem = AdminMenuDetailResponse['categories'][number]['items'][number]
const nullableText = (value: string) => value.trim() || null
const nullableNumber = (value: string) => value === '' ? null : Number(value)

function toItemDraft(item: MenuItem): UpsertMenuItemRequest {
  const { id: _id, ...draft } = item
  return draft
}

export function MenuPage() {
  const { api: auth } = useAuth()
  const api = useMemo(() => new CatalogAdminApi(auth), [auth])
  const queryClient = useQueryClient()
  const [menu, setMenu] = useState(emptyMenu)
  const [category, setCategory] = useState(emptyCategory)
  const [item, setItem] = useState(emptyItem)
  const [categoryId, setCategoryId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  const menus = useQuery({ queryKey: ['admin', 'menus'], queryFn: () => api.listMenus() })
  const detail = useQuery({
    queryKey: ['admin', 'menu', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => api.getMenu(selectedId),
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'menus'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'menu', selectedId] })
  }

  const addMenu = useMutation({
    mutationFn: () => api.createMenu(menu),
    onSuccess: ({ menu: created }) => {
      setSelectedId(created.id)
      setMenu(emptyMenu)
      refresh()
    },
  })
  const addCategory = useMutation({
    mutationFn: () => api.createCategory(selectedId, category),
    onSuccess: () => {
      setCategory(emptyCategory)
      refresh()
    },
  })
  const saveItem = useMutation({
    mutationFn: () => editingItemId ? api.updateItem(editingItemId, item) : api.createItem(categoryId, item),
    onSuccess: () => {
      setItem(emptyItem)
      setEditingItemId(null)
      refresh()
    },
  })

  const startItem = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId)
    setItem(emptyItem)
    setEditingItemId(null)
  }
  const editItem = (nextCategoryId: string, nextItem: MenuItem) => {
    setCategoryId(nextCategoryId)
    setItem(toItemDraft(nextItem))
    setEditingItemId(nextItem.id)
  }

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-9 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Наборы меню</CardTitle>
          <CardDescription>Базовые меню для ресторанов сети.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {menus.data?.menus.map((entry) => (
            <button
              className="rounded-xl border p-3 text-left transition-colors hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-muted"
              data-active={entry.id === selectedId}
              key={entry.id}
              onClick={() => { setSelectedId(entry.id); setEditingItemId(null); setCategoryId('') }}
              type="button"
            >
              <b>{entry.name}</b>
              <small className="block text-muted-foreground">{entry.categoryCount} категорий · {entry.restaurantCount} точек</small>
            </button>
          ))}
          <form className="mt-4 grid gap-2 border-t pt-4" onSubmit={(event) => { event.preventDefault(); addMenu.mutate() }}>
            <Input onChange={(event) => setMenu((value) => ({ ...value, name: event.target.value }))} placeholder="Название нового меню" required value={menu.name} />
            <Input onChange={(event) => setMenu((value) => ({ ...value, slug: event.target.value }))} placeholder="city-core" required value={menu.slug} />
            <Button disabled={addMenu.isPending} type="submit">Создать набор</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6">
        {detail.data ? <>
          <Card>
            <CardHeader>
              <CardTitle>{detail.data.menu.name}</CardTitle>
              <CardDescription>Выберите блюдо для изменения или добавьте новое в нужную категорию.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              {detail.data.categories.map((entry) => (
                <section className="grid gap-2 border-t pt-4 first:border-t-0 first:pt-0" key={entry.id}>
                  <div className="flex items-center justify-between gap-3">
                    <b>{entry.position}. {entry.name}</b>
                    <Button onClick={() => startItem(entry.id)} size="xs" type="button">Добавить блюдо</Button>
                  </div>
                  {entry.items.length === 0 ? <p className="text-sm text-muted-foreground">В этой категории пока нет блюд.</p> : (
                    <div className="divide-y rounded-xl border">
                      {entry.items.map((menuItem) => (
                        <button className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left hover:bg-muted" key={menuItem.id} onClick={() => editItem(entry.id, menuItem)} type="button">
                          <span><b className="block text-sm">{menuItem.name}</b><small className="text-muted-foreground">{menuItem.weightGrams ? `${menuItem.weightGrams} г · ` : ''}{menuItem.marketingBadge ?? 'без метки'}</small></span>
                          <span className="shrink-0 text-sm font-medium">{menuItem.priceKopecks / 100} ₽</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <Editor disabled={addCategory.isPending} onSubmit={() => addCategory.mutate()} title="Новая категория">
              <Input onChange={(event) => setCategory((value) => ({ ...value, name: event.target.value }))} placeholder="Завтраки" required value={category.name} />
              <Input onChange={(event) => setCategory((value) => ({ ...value, slug: event.target.value }))} placeholder="breakfast" required value={category.slug} />
              <NumberInput label="Позиция" onChange={(position) => setCategory((value) => ({ ...value, position: Number(position) }))} value={category.position} />
            </Editor>

            <Editor disabled={!categoryId || saveItem.isPending} onSubmit={() => saveItem.mutate()} title={editingItemId ? 'Редактирование блюда' : 'Новое блюдо'}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input onChange={(event) => setItem((value) => ({ ...value, name: event.target.value }))} placeholder="Название" required value={item.name} />
                <Input onChange={(event) => setItem((value) => ({ ...value, slug: event.target.value }))} placeholder="avocado-toast" required value={item.slug} />
              </div>
              <Textarea onChange={(event) => setItem((value) => ({ ...value, description: nullableText(event.target.value) }))} placeholder="Короткое описание" value={item.description ?? ''} />
              <Textarea onChange={(event) => setItem((value) => ({ ...value, ingredients: nullableText(event.target.value) }))} placeholder="Состав и ингредиенты" value={item.ingredients ?? ''} />
              <div className="grid gap-3 sm:grid-cols-3">
                <NumberInput label="Цена, ₽" min={0} onChange={(value) => setItem((draft) => ({ ...draft, priceKopecks: Math.round(Number(value) * 100) }))} required value={item.priceKopecks / 100} />
                <NullableNumberInput label="Вес, г" onChange={(value) => setItem((draft) => ({ ...draft, weightGrams: nullableNumber(value) }))} value={item.weightGrams} />
                <NumberInput label="Позиция" min={0} onChange={(value) => setItem((draft) => ({ ...draft, position: Number(value) }))} value={item.position} />
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <NullableNumberInput label="Ккал" onChange={(value) => setItem((draft) => ({ ...draft, calories: nullableNumber(value) }))} value={item.calories} />
                <NullableNumberInput label="Белки" onChange={(value) => setItem((draft) => ({ ...draft, proteins: nullableNumber(value) }))} value={item.proteins} />
                <NullableNumberInput label="Жиры" onChange={(value) => setItem((draft) => ({ ...draft, fats: nullableNumber(value) }))} value={item.fats} />
                <NullableNumberInput label="Углеводы" onChange={(value) => setItem((draft) => ({ ...draft, carbohydrates: nullableNumber(value) }))} value={item.carbohydrates} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input onChange={(event) => setItem((value) => ({ ...value, imageUrl: nullableText(event.target.value) }))} placeholder="https://… ссылка на фото" type="url" value={item.imageUrl ?? ''} />
                <label className="grid gap-1 text-sm font-medium">Метка
                  <select className="h-10 rounded-xl border bg-input/30 px-3" onChange={(event) => setItem((value) => ({ ...value, marketingBadge: event.target.value ? event.target.value as MarketingBadge : null }))} value={item.marketingBadge ?? ''}>
                    <option value="">Без метки</option><option value="NEW">Новинка</option><option value="HIT">Хит</option><option value="SEASONAL">Сезонное</option><option value="SPECIAL">Спецпредложение</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-3">
                <Flag checked={item.isVegetarian} label="Вегетарианское" onChange={(checked) => setItem((value) => ({ ...value, isVegetarian: checked }))} />
                <Flag checked={item.isSpicy} label="Острое" onChange={(checked) => setItem((value) => ({ ...value, isSpicy: checked }))} />
                <Flag checked={item.isLactoseFree} label="Без лактозы" onChange={(checked) => setItem((value) => ({ ...value, isLactoseFree: checked }))} />
                <Flag checked={item.isGlutenFree} label="Без глютена" onChange={(checked) => setItem((value) => ({ ...value, isGlutenFree: checked }))} />
                <Flag checked={item.isLight} label="Лёгкое" onChange={(checked) => setItem((value) => ({ ...value, isLight: checked }))} />
              </div>
              <p className="text-xs text-muted-foreground">{categoryId ? 'Изменения сохранятся в выбранной категории.' : 'Сначала выберите категорию кнопкой «Добавить блюдо».'}</p>
              {editingItemId ? <Button onClick={() => { setItem(emptyItem); setEditingItemId(null) }} type="button" variant="outline">Отменить редактирование</Button> : null}
            </Editor>
          </div>
        </> : <Card><CardContent className="py-14 text-muted-foreground">Выберите набор меню слева.</CardContent></Card>}
      </div>
    </section>
  )
}

function Editor({ title, onSubmit, disabled, children }: { title: string; onSubmit: () => void; disabled: boolean; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>{children}<Button disabled={disabled} type="submit">Сохранить</Button></form></CardContent></Card>
}

function NumberInput({ label, value, onChange, min, required }: { label: string; value: number; onChange: (value: string) => void; min?: number; required?: boolean }) {
  return <label className="grid gap-1 text-sm font-medium">{label}<Input min={min} onChange={(event) => onChange(event.target.value)} required={required} step="any" type="number" value={value} /></label>
}

function NullableNumberInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm font-medium">{label}<Input min={0} onChange={(event) => onChange(event.target.value)} step="any" type="number" value={value ?? ''} /></label>
}

function Flag({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-2"><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>
}
