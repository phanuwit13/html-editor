import { useState } from 'react'
import { Scan, SquareDashed } from 'lucide-react'
import { CORNERS, type InspectorModel } from '../../../editor/styleReader'
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

const CORNER_LABEL: Record<(typeof CORNERS)[number], string> = {
  'top-left': 'TL',
  'top-right': 'TR',
  'bottom-right': 'BR',
  'bottom-left': 'BL',
}

export default function Border({ model }: Props) {
  const b = model.border
  const allEqual = CORNERS.every((c) => b.radius[c] === b.radius['top-left'])
  const [split, setSplit] = useState(!allEqual)

  const commitWidth = (css: string, coalesce: boolean) => {
    const props: Record<string, string> = { 'border-width': css }
    if (Number.parseFloat(css) > 0 && b.style === 'none') props['border-style'] = 'solid'
    apply(props, coalesce, 'border-width')
  }

  return (
    <Section title="Border">
      <div className="flex items-center gap-1.5">
        <NumberInput
          className="flex-1"
          label="R"
          title="Corner radius"
          value={allEqual ? b.radius['top-left'] : ''}
          placeholder="Mixed"
          scrubBase={Number.parseFloat(b.radius['top-left']) || 0}
          min={0}
          onCommit={(css, coalesce) =>
            apply(Object.fromEntries(CORNERS.map((c) => [`border-${c}-radius`, css])), coalesce, 'border-radius')
          }
        />
        <button
          type="button"
          title={split ? 'Hide individual corners' : 'Individual corners'}
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800',
            split && 'bg-neutral-100 text-sky-600',
          )}
          onClick={() => setSplit((s) => !s)}
        >
          {split ? <SquareDashed className="size-3.5" /> : <Scan className="size-3.5" />}
        </button>
      </div>
      {split && (
        <div className="grid grid-cols-2 gap-1.5">
          {CORNERS.map((c) => (
            <NumberInput
              key={c}
              label={CORNER_LABEL[c]}
              title={`${c} radius`}
              value={b.radius[c]}
              min={0}
              onCommit={(css, coalesce) => apply({ [`border-${c}-radius`]: css }, coalesce, `border-${c}-radius`)}
            />
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <NumberInput label="W" title="Border width" value={b.style === 'none' ? '0' : b.width} min={0} onCommit={commitWidth} />
        <ColorInput value={b.color} onCommit={(css, coalesce) => apply({ 'border-color': css }, coalesce, 'border-color')} />
      </div>
    </Section>
  )
}
