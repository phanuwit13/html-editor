import { useEffect, useState } from 'react'
import Canvas from './components/Canvas'
import DropZone from './components/DropZone'
import Inspector from './components/Inspector/Inspector'
import LayersPanel from './components/LayersPanel'
import Breadcrumb from './components/Breadcrumb'
import Toolbar from './components/Toolbar'
import { handleShortcut } from './editor/shortcuts'
import { useEditorStore } from './store/useEditorStore'

function Notice() {
  const notice = useEditorStore((s) => s.notice)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!notice) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 2600)
    return () => clearTimeout(t)
  }, [notice])
  if (!notice || !visible) return null
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-[12px] text-white shadow-lg">{notice.text}</div>
  )
}

export default function App() {
  const hasFile = useEditorStore((s) => s.preparedHtml !== null)
  const mode = useEditorStore((s) => s.mode)
  const showLayers = useEditorStore((s) => s.showLayers)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (handleShortcut(e)) e.preventDefault()
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().patches.length) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  if (!hasFile)
    return (
      <>
        <DropZone />
        <Notice />
      </>
    )

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        {showLayers && (
          <aside className="w-[240px] shrink-0 overflow-hidden border-r border-neutral-200 bg-white">
            <LayersPanel />
          </aside>
        )}
        <Canvas />
        <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-neutral-200 bg-white">
          <Inspector />
        </aside>
      </div>
      <div className="flex h-6 shrink-0 items-center gap-3 border-t border-neutral-200 bg-white px-3 text-[11px] text-neutral-500">
        <span className={mode === 'edit' ? 'shrink-0 font-medium text-sky-600' : 'shrink-0'}>{mode === 'edit' ? 'Edit mode' : 'Play mode'}</span>
        <Breadcrumb />
        <span className="ml-auto hidden shrink-0 xl:inline">E toggle · Esc deselect · Enter edit text · ⇧Enter parent · ⌘D duplicate · ⌫ delete · ⌘Z undo · ⌘E export</span>
      </div>
      <Notice />
    </div>
  )
}
