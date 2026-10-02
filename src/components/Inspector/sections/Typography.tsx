import { TextAlignCenter, TextAlignEnd, TextAlignJustify, TextAlignStart } from 'lucide-react'
import type { InspectorModel } from '../../../editor/styleReader'
import { cn } from '../../../lib/cn'
import { useEditorStore } from '../../../store/useEditorStore'
import ColorInput from '../controls/ColorInput'
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
const one = (prop: string) => (css: string, coalesce: boolean) => apply({ [prop]: css }, coalesce, prop)

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900']
const WEIGHT_NAMES: Record<string, string> = {
  '100': 'Thin',
  '200': 'Extra Light',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'Semibold',
  '700': 'Bold',
  '800': 'Extra Bold',
  '900': 'Black',
}
const ALIGNS = [
  { value: 'left', Icon: TextAlignStart },
  { value: 'center', Icon: TextAlignCenter },
  { value: 'right', Icon: TextAlignEnd },
  { value: 'justify', Icon: TextAlignJustify },
] as const

export default function Typography({ model }: Props) {
  const t = model.typography
  const weights = WEIGHTS.includes(t.fontWeight) ? WEIGHTS : [...WEIGHTS, t.fontWeight].sort((a, b) => Number(a) - Number(b))
  const fontSizeNum = Number.parseFloat(t.fontSize) || 16

  return (
    <Section title="Typography">
      {t.fontFamily && (
        <div className="truncate text-[11px] text-neutral-500" title={t.fontFamily}>
          {t.fontFamily}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <NumberInput label="Sz" title="Font size" value={t.fontSize} min={1} onCommit={one('font-size')} />
        <select
          title="Font weight"
          className="h-7 min-w-0 rounded bg-neutral-100 px-1.5 text-[11px] text-neutral-800 outline-none hover:ring-1 hover:ring-neutral-300 focus:ring-1 focus:ring-sky-500"
          value={t.fontWeight}
          onChange={(e) => apply({ 'font-weight': e.target.value }, false, 'font-weight')}
        >
          {weights.map((w) => (
            <option key={w} value={w}>
              {w} {WEIGHT_NAMES[w] ?? ''}
            </option>
          ))}
        </select>
        <NumberInput
          label="LH"
          title="Line height"
          value={t.lineHeight}
          min={0}
          scrubBase={Math.round(fontSizeNum * 1.2)}
          onCommit={one('line-height')}
        />
        <NumberInput label="LS" title="Letter spacing" value={t.letterSpacing} step={0.1} onCommit={one('letter-spacing')} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex h-7 items-center rounded bg-neutral-100 p-0.5">
          {ALIGNS.map(({ value, Icon }) => (
            <button
              key={value}
              type="button"
              title={`Align ${value}`}
              className={cn(
                'flex h-full flex-1 items-center justify-center rounded-sm text-neutral-500 hover:text-neutral-800',
                t.textAlign === value && 'bg-white text-neutral-900 shadow-sm',
              )}
              onClick={() => t.textAlign !== value && apply({ 'text-align': value }, false, 'text-align')}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
        <ColorInput value={t.color} onCommit={one('color')} />
      </div>
    </Section>
  )
}
