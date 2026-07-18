import { cn } from '@/lib/utils'

export function AdminTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  className,
}: {
  label: string
  tabs: ReadonlyArray<{ value: T; label: string; count?: number }>
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('admin-tabs', className)} aria-label={label} role="group">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          aria-pressed={value === tab.value}
          className="admin-tab"
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {typeof tab.count === 'number' ? <span>{tab.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
