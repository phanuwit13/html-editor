import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'

interface Props {
  title: string
  /** optional controls rendered at the right of the title row */
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export default function Section({ title, actions, className, children }: Props) {
  return (
    <section className={cn('border-b border-neutral-200 p-3', className)}>
      <div className="mb-2 flex h-5 items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}
