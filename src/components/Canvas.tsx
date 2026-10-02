import { useEffect, useRef } from 'react'
import { canvas } from '../editor/canvasController'
import { handleShortcut } from '../editor/shortcuts'
import { useEditorStore } from '../store/useEditorStore'
import { cn } from '../lib/cn'

export default function Canvas() {
  const preparedHtml = useEditorStore((s) => s.preparedHtml)
  const iframeKey = useEditorStore((s) => s.iframeKey)
  const viewportWidth = useEditorStore((s) => s.viewportWidth)
  const mode = useEditorStore((s) => s.mode)
  const ref = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const s = useEditorStore.getState
    canvas.setCallbacks({
      onHover: (el) => s().setHovered(el),
      onSelect: (el) => s().select(el),
      onTextCommit: (el, before, after, html) => s().setText(el, before, after, html, true),
      onKey: handleShortcut,
      onNotice: (t) => s().notify(t),
    })
    return () => canvas.detach()
  }, [])

  const onLoad = () => {
    if (!ref.current) return
    canvas.attach(ref.current)
    useEditorStore.getState().onCanvasLoad()
  }

  const full = viewportWidth === 'full'
  return (
    <div className={cn('relative flex-1 overflow-auto bg-neutral-200/70', !full && 'p-6')}>
      <div
        className={cn('mx-auto h-full bg-white transition-[width] duration-200', !full && 'shadow-lg ring-1 ring-black/5', mode === 'edit' && 'ring-2 ring-sky-500/60')}
        style={{ width: full ? '100%' : viewportWidth, minHeight: 400 }}
      >
        {preparedHtml && (
          <iframe
            key={iframeKey}
            ref={ref}
            title="Canvas"
            className="block h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            srcDoc={preparedHtml}
            onLoad={onLoad}
          />
        )}
      </div>
    </div>
  )
}
