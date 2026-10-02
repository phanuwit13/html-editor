import type { InspectorModel } from '../../../editor/styleReader'
import { cn } from '../../../lib/cn'
import { round } from '../../../lib/units'
import { useEditorStore } from '../../../store/useEditorStore'
import NumberInput from '../controls/NumberInput'
import Section from '../controls/Section'

interface Props {
  el: HTMLElement
  model: InspectorModel
}

function apply(props: Record<string, string>, coalesce: boolean, key: string) {
  const { selectedTwId, setStyle } = useEditorStore.getState()
  setStyle(props, coalesce ? `${selectedTwId}:${key}` : undefined)
}

const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
} as const
type Preset = keyof typeof SHADOWS

/** Serialise a shadow the way the browser does so presets can be matched against inline styles. */
function normalizeShadow(el: HTMLElement, v: string) {
  const s = el.ownerDocument.createElement('div').style
  s.boxShadow = v
  return s.boxShadow
}

export default function Effects({ el, model }: Props) {
  const opacityPct = round((Number.parseFloat(model.effects.opacity) || 0) * 100)
  const setOpacity = (pct: number, coalesce: boolean) => {
    const v = Math.max(0, Math.min(100, pct))
    apply({ opacity: String(round(v / 100)) }, coalesce, 'opacity')
  }

  const inline = el.style.getPropertyValue('box-shadow')
  let active: Preset | null = null
  if (model.effects.boxShadow === 'none') active = 'none'
  else if (inline) {
    const n = normalizeShadow(el, inline)
    active = (Object.keys(SHADOWS) as Preset[]).find((k) => normalizeShadow(el, SHADOWS[k]) === n) ?? null
  }

  return (
    <Section title="Effects">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          title="Opacity"
          value={opacityPct}
          className="h-1 min-w-0 flex-1 cursor-pointer accent-sky-500"
          onChange={(e) => setOpacity(Number(e.target.value), true)}
        />
        <NumberInput
          className="w-16 shrink-0"
          label="%"
          title="Opacity (%)"
          value={String(opacityPct)}
          unit=""
          min={0}
          max={100}
          onCommit={(css, coalesce) => {
            const n = Number.parseFloat(css)
            if (!Number.isNaN(n)) setOpacity(n, coalesce)
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-neutral-500">Shadow</span>
        <div className="grid grid-cols-4 gap-0.5 rounded bg-neutral-100 p-0.5">
          {(Object.keys(SHADOWS) as Preset[]).map((k) => (
            <button
              key={k}
              type="button"
              className={cn(
                'h-6 rounded-sm text-[11px] capitalize text-neutral-500 hover:text-neutral-800',
                active === k && 'bg-white text-neutral-900 shadow-sm',
              )}
              onClick={() => active !== k && apply({ 'box-shadow': SHADOWS[k] }, false, 'box-shadow')}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </Section>
  )
}
