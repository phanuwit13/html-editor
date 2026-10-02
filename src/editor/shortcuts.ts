import { useEditorStore } from '../store/useEditorStore'
import { canvas } from './canvasController'
import { downloadFile, editedFileName, exportHtml } from './exporter'

const isTypingTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
}

export function exportCurrent() {
  const s = useEditorStore.getState()
  if (!s.preparedHtml) return
  canvas.commitText()
  const { preparedHtml, patches, isFragment, fileName } = useEditorStore.getState()
  downloadFile(editedFileName(fileName), exportHtml(preparedHtml!, patches, isFragment))
  s.notify(`Exported ${editedFileName(fileName)}`)
}

/**
 * Global keyboard shortcuts. Called from the editor window and forwarded from inside the iframe.
 * Returns true when handled.
 */
export function handleShortcut(e: KeyboardEvent): boolean {
  const s = useEditorStore.getState()
  if (!s.preparedHtml) return false
  const mod = e.metaKey || e.ctrlKey
  const key = e.key.toLowerCase()

  if (mod && key === 'e') {
    exportCurrent()
    return true
  }
  // Inspector inputs keep their native keys (typing, native undo)
  if (isTypingTarget(e.target) && !(e.target as HTMLElement).ownerDocument?.defaultView?.frameElement) return false

  if (mod && key === 'z') {
    if (e.shiftKey) s.redo()
    else s.undo()
    return true
  }
  if (mod && key === 'y') {
    s.redo()
    return true
  }
  if (mod || e.altKey) return false

  if (key === 'e') {
    s.toggleMode()
    return true
  }
  if (s.mode !== 'edit') return false

  switch (e.key) {
    case 'Escape':
      if (s.selectedEl) s.select(null)
      return true
    case 'Delete':
    case 'Backspace':
      if (!s.selectedEl) return false
      s.removeSelected()
      return true
    case 'Enter':
      if (!s.selectedEl) return false
      if (e.shiftKey) s.selectParent()
      else canvas.startTextEdit(s.selectedEl)
      return true
  }
  return false
}
