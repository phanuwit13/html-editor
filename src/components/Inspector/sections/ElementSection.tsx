import { ChevronRight, Copy, Eye, EyeOff, Trash2 } from 'lucide-react'
import { shortLabel } from '../../../editor/selector'
import type { InspectorModel } from '../../../editor/styleReader'
import { useEditorStore } from '../../../store/useEditorStore'
import Section from '../controls/Section'

interface Props {
  el: HTMLElement
  model: InspectorModel
}

const MAX_ANCESTORS = 4

export default function ElementSection({ el, model }: Props) {
  const ancestors: HTMLElement[] = []
  for (let p = el.parentElement; p && p.tagName !== 'HTML'; p = p.parentElement) ancestors.unshift(p)
  const shown = ancestors.slice(-MAX_ANCESTORS)
  const truncated = ancestors.length > shown.length
  const hidden = model.display === 'none'
  const isBody = el.tagName === 'BODY'
  const { select, toggleHidden, removeSelected } = useEditorStore.getState()

  return (
    <Section title="Element">
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
        {truncated && <span>…</span>}
        {shown.map((a, i) => (
          <span key={i} className="flex items-center gap-1">
            {(i > 0 || truncated) && <ChevronRight className="size-3 text-neutral-300" />}
            <button
              type="button"
              className="max-w-[140px] truncate rounded px-1 hover:bg-neutral-100 hover:text-neutral-800"
              title={shortLabel(a)}
              onClick={() => select(a)}
            >
              {shortLabel(a)}
            </button>
          </span>
        ))}
        {shown.length > 0 && <ChevronRight className="size-3 text-neutral-300" />}
        <span className="max-w-[140px] truncate px-1 font-medium text-neutral-800">{shortLabel(el)}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        <span className="rounded bg-sky-50 px-1.5 py-0.5 font-mono text-[11px] text-sky-700">{model.tag}</span>
        {model.classes.map((c) => (
          <span key={c} className="max-w-full truncate rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-600" title={c}>
            .{c}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          className="flex h-7 items-center justify-center gap-1.5 rounded bg-neutral-100 text-[11px] text-neutral-700 hover:bg-neutral-200"
          onClick={() => toggleHidden()}
        >
          {hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {hidden ? 'Show' : 'Hide'}
        </button>
        <button
          type="button"
          disabled={isBody}
          title="Duplicate (⌘D)"
          className="flex h-7 items-center justify-center gap-1.5 rounded bg-neutral-100 text-[11px] text-neutral-700 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => useEditorStore.getState().duplicateSelected()}
        >
          <Copy className="size-3.5" />
          Duplicate
        </button>
        <button
          type="button"
          disabled={isBody}
          className="flex h-7 items-center justify-center gap-1.5 rounded bg-neutral-100 text-[11px] text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => removeSelected()}
        >
          <Trash2 className="size-3.5" />
          Delete
        </button>
      </div>
    </Section>
  )
}
