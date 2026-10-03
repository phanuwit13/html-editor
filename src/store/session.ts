import { useEditorStore, type HistoryEntry, type Viewport } from './useEditorStore'

/**
 * Remember the open file + edit history in sessionStorage so a refresh doesn't lose work.
 * Not a project store: it dies with the tab.
 */
const FILE_KEY = 'html-tweaker:file'
const HISTORY_KEY = 'html-tweaker:history'

interface SavedHistory {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  viewportWidth: Viewport
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function restoreSession() {
  try {
    const file = JSON.parse(sessionStorage.getItem(FILE_KEY) ?? 'null') as { name: string; html: string } | null
    if (!file) return
    const s = useEditorStore.getState()
    s.loadFile(file.name, file.html)
    const h = JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? 'null') as SavedHistory | null
    if (h) s.restoreHistory(h.undoStack, h.redoStack, h.viewportWidth)
  } catch {
    /* corrupted or blocked storage — start fresh */
  }
}

export function startSessionSync() {
  let timer = 0
  let warned = false
  useEditorStore.subscribe((state, prev) => {
    if (state.originalHtml !== prev.originalHtml) {
      if (!state.originalHtml) {
        try {
          sessionStorage.removeItem(FILE_KEY)
          sessionStorage.removeItem(HISTORY_KEY)
        } catch {
          /* ignore */
        }
        return
      }
      if (!write(FILE_KEY, { name: state.fileName, html: state.originalHtml }) && !warned) {
        warned = true
        state.notify('File is too large to keep across a refresh — export before reloading')
      }
    }
    if (state.undoStack !== prev.undoStack || state.redoStack !== prev.redoStack || state.viewportWidth !== prev.viewportWidth) {
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        const { undoStack, redoStack, viewportWidth, originalHtml } = useEditorStore.getState()
        if (originalHtml) write(HISTORY_KEY, { undoStack, redoStack, viewportWidth } satisfies SavedHistory)
      }, 300)
    }
  })
}
