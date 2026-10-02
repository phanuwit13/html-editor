import type { InspectorModel } from '../../../editor/styleReader'
import { useEditorStore } from '../../../store/useEditorStore'
import FourSides from '../controls/FourSides'
import Section from '../controls/Section'

interface Props {
  el: HTMLElement
  model: InspectorModel
}

const commit = (key: string) => (props: Record<string, string>, coalesce: boolean) => {
  const { selectedTwId, setStyle } = useEditorStore.getState()
  setStyle(props, coalesce ? `${selectedTwId}:${key}` : undefined)
}

export default function Spacing({ model }: Props) {
  return (
    <Section title="Spacing">
      <FourSides label="Padding" prop="padding" values={model.padding} min={0} onCommit={commit('padding')} />
      <FourSides label="Margin" prop="margin" values={model.margin} onCommit={commit('margin')} />
    </Section>
  )
}
