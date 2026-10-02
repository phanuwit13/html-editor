import { useState } from 'react'
import { Link, Scan, Unlink } from 'lucide-react'
import type { Side } from '../../../editor/patches'
import { SIDES } from '../../../editor/styleReader'
import { cn } from '../../../lib/cn'
import NumberInput from './NumberInput'

interface Props {
  label: string
  /** CSS property prefix: 'padding' | 'margin' */
  prop: string
  values: Record<Side, string>
  min?: number
  onCommit: (props: Record<string, string>, coalesce: boolean) => void
}

const SIDE_LABEL: Record<Side, string> = { top: 'T', right: 'R', bottom: 'B', left: 'L' }

export default function FourSides({ label, prop, values, min, onCommit }: Props) {
  const allEqual = SIDES.every((s) => values[s] === values.top)
  const [linked, setLinked] = useState(allEqual)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-neutral-500">{label}</span>
        <button
          type="button"
          title={linked ? 'Edit sides separately' : 'Link all sides'}
          className={cn(
            'flex size-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800',
            linked && 'text-sky-600',
          )}
          onClick={() => setLinked((l) => !l)}
        >
          {linked ? <Link className="size-3.5" /> : <Unlink className="size-3.5" />}
        </button>
      </div>
      {linked ? (
        <NumberInput
          label={<Scan />}
          title={`${label} (all sides)`}
          value={allEqual ? values.top : ''}
          placeholder="Mixed"
          scrubBase={allEqual ? undefined : Number.parseFloat(values.top) || 0}
          min={min}
          onCommit={(css, coalesce) =>
            onCommit(Object.fromEntries(SIDES.map((s) => [`${prop}-${s}`, css])), coalesce)
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {SIDES.map((s) => (
            <NumberInput
              key={s}
              label={SIDE_LABEL[s]}
              title={`${label} ${s}`}
              value={values[s]}
              min={min}
              onCommit={(css, coalesce) => onCommit({ [`${prop}-${s}`]: css }, coalesce)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
