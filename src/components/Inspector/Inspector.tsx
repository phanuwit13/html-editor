import { useMemo } from 'react'
import { MousePointerClick } from 'lucide-react'
import { readStyle } from '../../editor/styleReader'
import { runtimeSelector } from '../../editor/selector'
import { useEditorStore } from '../../store/useEditorStore'
import Border from './sections/Border'
import Effects from './sections/Effects'
import ElementSection from './sections/ElementSection'
import Fill from './sections/Fill'
import Size from './sections/Size'
import Spacing from './sections/Spacing'
import TextSection from './sections/TextSection'
import Typography from './sections/Typography'

export default function Inspector() {
  const el = useEditorStore((s) => s.selectedEl)
  const twId = useEditorStore((s) => s.selectedTwId)
  const revision = useEditorStore((s) => s.revision)
  const mode = useEditorStore((s) => s.mode)

  // revision is an intentional dependency: it bumps whenever we change the live DOM
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => (el?.isConnected ? readStyle(el) : null), [el, revision])

  if (!el || !model) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-[12px] text-neutral-400">
        <MousePointerClick className="size-5" />
        {mode === 'edit' ? 'Click an element to inspect it' : 'Press E for Edit mode, then click an element'}
      </div>
    )
  }

  const props = { el, model }
  return (
    // keyed by element so local UI state (linked toggles, drafts) resets on selection change
    <div key={twId ?? runtimeSelector(el)} className="h-full w-full overflow-y-auto overflow-x-hidden text-[12px] text-neutral-800">
      <ElementSection {...props} />
      {!twId && (
        <p className="mx-3 mt-3 rounded-md bg-amber-50 p-2 text-[11px] leading-4 text-amber-800">
          Rendered by the page&apos;s script. Style edits are saved as a CSS rule and exported in a <code>&lt;style&gt;</code> block.
          Text edits show in the preview and the change list only — the text lives in the JavaScript.
        </p>
      )}
      <TextSection {...props} />
      <Typography {...props} />
      <Fill {...props} />
      <Spacing {...props} />
      <Size {...props} />
      <Border {...props} />
      <Effects {...props} />
    </div>
  )
}
