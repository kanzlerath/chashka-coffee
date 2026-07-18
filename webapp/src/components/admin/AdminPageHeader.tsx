import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('admin-page-header', className)}>
      <div className="grid gap-1.5">
        {eyebrow ? <p className="admin-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  )
}
