import { SearchIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { adminSearchResponseSchema, hasPermission, type AdminSearchResult, type StaffPermission } from '@chashka-coffee/contracts'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { useAuth } from '@/features/auth'

const commands = [
  { label: 'Обзор', href: '/', group: 'Работа' },
  { label: 'Заказы', href: '/orders', group: 'Работа', permission: 'ORDERS_MANAGE' },
  { label: 'Рестораны', href: '/restaurants', group: 'Работа', permission: 'CATALOG_MANAGE' },
  { label: 'Меню', href: '/menus', group: 'Работа', permission: 'CATALOG_MANAGE' },
  { label: 'Заявки и отклики', href: '/leads', group: 'Работа', permissions: ['LEADS_MANAGE', 'JOB_APPLICATIONS_MANAGE'] },
  { label: 'Главная страница', href: '/homepage', group: 'Сайт', permission: 'CONTENT_MANAGE' },
  { label: 'Страницы', href: '/pages', group: 'Сайт', permission: 'CONTENT_MANAGE' },
  { label: 'Кофе', href: '/products/coffee', group: 'Сайт', permission: 'CATALOG_MANAGE' },
  { label: 'Торты', href: '/products/cakes', group: 'Сайт', permission: 'CATALOG_MANAGE' },
  { label: 'Акции', href: '/content/promotions', group: 'Сайт', permission: 'CONTENT_MANAGE' },
  { label: 'События', href: '/content/events', group: 'Сайт', permission: 'CONTENT_MANAGE' },
  { label: 'Журнал', href: '/content/journal', group: 'Сайт', permission: 'CONTENT_MANAGE' },
  { label: 'Вакансии', href: '/jobs', group: 'Работа', permission: 'JOBS_MANAGE' },
  { label: 'История изменений', href: '/activity', group: 'Система', permission: 'AUDIT_READ' },
] satisfies readonly ({ label: string; href: string; group: string; permission?: StaffPermission; permissions?: StaffPermission[] })[]

const resourceLabel: Record<AdminSearchResult['resource'], string> = {
  RESTAURANT: 'Ресторан', MENU: 'Меню', LEAD: 'Заявка', CONTENT: 'Материал', PRODUCT: 'Товар', JOB: 'Вакансия',
}

export function AdminCommandMenu() {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 180)
    return () => window.clearTimeout(timer)
  }, [query])

  const search = useQuery({
    queryKey: ['admin', 'workspace', 'search', debouncedQuery],
    enabled: hasPermission(auth.user, 'AUDIT_READ') && debouncedQuery.length >= 2,
    queryFn: () => auth.api.request(`/api/admin/workspace/search?q=${encodeURIComponent(debouncedQuery)}`, adminSearchResponseSchema),
  })
  const availableCommands = useMemo(() => commands.filter((item) => {
    if ('permission' in item && item.permission) return hasPermission(auth.user, item.permission)
    if ('permissions' in item && item.permissions) return item.permissions.some((permission) => hasPermission(auth.user, permission))
    return true
  }), [auth.user])

  const go = (href: string) => {
    setOpen(false)
    window.location.assign(href)
  }

  return (
    <>
      <Button className="admin-command-trigger" type="button" variant="outline" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={SearchIcon} size={17} strokeWidth={1.8} />
        <span>Найти</span>
        <kbd>⌘ K</kbd>
      </Button>
      <CommandDialog className="admin-command-dialog" description="Поиск по разделам и данным админки" open={open} title="Поиск" onOpenChange={setOpen}>
        <CommandInput autoFocus placeholder="Раздел, ресторан, материал, заявка…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{search.isFetching ? 'Ищем…' : 'Ничего не найдено'}</CommandEmpty>
          <CommandGroup heading="Разделы">
            {availableCommands.map((item) => (
              <CommandItem key={item.href} value={`${item.label} ${item.group}`} onSelect={() => go(item.href)}>
                <span>{item.label}</span><CommandShortcut>{item.group}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          {search.data?.results.length ? (
            <CommandGroup heading="Данные">
              {search.data.results.map((item) => (
                <CommandItem key={`${item.resource}:${item.id}`} value={`${item.title} ${item.subtitle ?? ''}`} onSelect={() => go(item.href)}>
                  <span className="admin-command-result"><strong>{item.title}</strong><small>{item.subtitle ?? resourceLabel[item.resource]}</small></span>
                  <CommandShortcut>{resourceLabel[item.resource]}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}
