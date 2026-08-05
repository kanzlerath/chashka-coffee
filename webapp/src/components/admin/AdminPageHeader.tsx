import type { ReactNode } from 'react'

import { Typography } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

export function AdminPageHeader({
  title,
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
      <Typography as="h1" variant="h1">{title}</Typography>
      {actions ? <Typography as="div" variant="bodySm" className="admin-page-actions">{actions}</Typography> : null}
    </header>
  )
}
