import type { InspectorModel } from '../../../editor/styleReader'
import { round } from '../../../lib/units'
import { useEditorStore } from '../../../store/useEditorStore'
import NumberInput from '../controls/NumberInput'
import Section from '../controls/Section'

interface Props {
  el: HTMLElement
  model: InspectorModel
}

type Unit = 'px' | '%' | 'auto'
type Dim = 'width' | 'height'

function apply(prop: Dim, css: string, coalesce: boolean) {
  const { selectedTwId, setStyle } = useEditorStore.getState()
  setStyle({ [prop]: css }, coalesce ? `${selectedTwId}:${prop}` : undefined)
}

const unitOf = (inline: string): Unit => (inline === 'auto' ? 'auto' : inline.trim().endsWith('%') ? '%' : 'px')

export default function Size({ el, model }: Props) {
  return (
    <Section title="Size">
      <div className="grid grid-cols-2 gap-1.5">
        <Dimension el={el} prop="width" label="W" computed={model.size.width} inline={model.size.inlineWidth} />
        <Dimension el={el} prop="height" label="H" computed={model.size.height} inline={model.size.inlineHeight} />
      </div>
    </Section>
  )
}

function Dimension({ el, prop, label, computed, inline }: { el: HTMLElement; prop: Dim; label: string; computed: string; inline: string }) {
  const unit = unitOf(inline)
  const value = unit === '%' ? String(round(Number.parseFloat(inline))) : computed

  const changeUnit = (next: Unit) => {
    if (next === unit) return
    if (next === 'auto') return apply(prop, 'auto', false)
    const win = el.ownerDocument.defaultView!
    // computed width/height respect box-sizing, so writing it back is a visual no-op
    const currentPx = Number.parseFloat(win.getComputedStyle(el).getPropertyValue(prop)) || Number.parseFloat(computed) || 0
    if (next === 'px') return apply(prop, `${round(currentPx)}px`, false)
    const parent = el.parentElement
    const parentPx = parent ? Number.parseFloat(win.getComputedStyle(parent).getPropertyValue(prop)) : NaN
    if (!parentPx) return apply(prop, '100%', false)
    apply(prop, `${round((currentPx / parentPx) * 100)}%`, false)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <NumberInput
        label={label}
        title={prop}
        value={value}
        min={0}
        unit={unit === '%' ? '%' : 'px'}
        onCommit={(css, coalesce) => apply(prop, css, coalesce)}
      />
      <select
        title={`${prop} unit`}
        className="h-6 min-w-0 rounded bg-neutral-100 px-1 text-[11px] text-neutral-600 outline-none hover:ring-1 hover:ring-neutral-300 focus:ring-1 focus:ring-sky-500"
        value={unit}
        onChange={(e) => changeUnit(e.target.value as Unit)}
      >
        <option value="px">px</option>
        <option value="%">%</option>
        <option value="auto">auto</option>
      </select>
    </div>
  )
}
