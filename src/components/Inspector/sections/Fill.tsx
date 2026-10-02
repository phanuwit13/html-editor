import type { InspectorModel } from '../../../editor/styleReader'
import { useEditorStore } from '../../../store/useEditorStore'
import ColorInput from '../controls/ColorInput'
import Section from '../controls/Section'

interface Props {
  el: HTMLElement
  model: InspectorModel
}

export default function Fill({ model }: Props) {
  return (
    <Section title="Fill">
      <ColorInput
        allowTransparent
        value={model.fill.backgroundColor}
        onCommit={(css, coalesce) => {
          const { selectedTwId, setStyle } = useEditorStore.getState()
          setStyle({ 'background-color': css }, coalesce ? `${selectedTwId}:background-color` : undefined)
        }}
      />
    </Section>
  )
}
