import { create } from 'zustand'
import { canvas } from '../editor/canvasController'
import { applyPatch, mergeAll, newPatchId, readRuleValue, revertPatch, TW_ATTR, findByTwId, type NewPatch, type Patch, type StylePatch } from '../editor/patches'
import { readableSelector, runtimeSelector } from '../editor/selector'
import { prepareHtml } from '../editor/prepareHtml'
import { displayValue } from '../editor/styleReader'

export type Mode = 'play' | 'edit'
export type Viewport = number | 'full'

export interface HistoryEntry {
  patches: Patch[]
  /** consecutive edits with the same key (scrubbing, colour dragging, typing) collapse into one undo step */
  key?: string
  ts: number
}

export interface EditorState {
  fileName: string | null
  originalHtml: string | null
  preparedHtml: string | null
  isFragment: boolean
  mode: Mode
  selectedTwId: string | null
  /** live element (may have no twId when created by the page's script) */
  selectedEl: HTMLElement | null
  hoveredTwId: string | null
  patches: Patch[]
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  viewportWidth: Viewport
  /** bumps whenever the live DOM changes because of us — Inspector re-reads computed styles */
  revision: number
  iframeKey: number
  notice: { text: string; id: number } | null

  loadFile: (name: string, html: string) => void
  closeFile: () => void
  setMode: (mode: Mode) => void
  toggleMode: () => void
  select: (el: HTMLElement | null) => void
  setHovered: (el: HTMLElement | null) => void
  selectParent: () => void
  setStyle: (props: Record<string, string>, coalesceKey?: string) => void
  setText: (el: HTMLElement, before: string, after: string, html: boolean, alreadyApplied?: boolean, coalesceKey?: string) => void
  removeSelected: () => void
  toggleHidden: () => void
  undo: () => void
  redo: () => void
  resetPreview: () => void
  onCanvasLoad: () => void
  setViewport: (v: Viewport) => void
  notify: (text: string) => void
}

const twIdOf = (el: Element | null) => el?.getAttribute(TW_ATTR) ?? null

/** How a patch addresses an element: by data-tw-id, or by structural selector for script-rendered ones. */
function targetOf(el: HTMLElement) {
  const twId = twIdOf(el)
  if (twId) return { twId, key: twId }
  const selector = runtimeSelector(el)
  return { twId: '', selector, label: readableSelector(el), key: `sel:${selector}` }
}
const derive = (stack: HistoryEntry[]) => mergeAll(stack.flatMap((e) => e.patches))

const initial = {
  fileName: null,
  originalHtml: null,
  preparedHtml: null,
  isFragment: false,
  mode: 'play' as Mode,
  selectedTwId: null,
  selectedEl: null,
  hoveredTwId: null,
  patches: [] as Patch[],
  undoStack: [] as HistoryEntry[],
  redoStack: [] as HistoryEntry[],
  revision: 0,
  notice: null,
}

export const useEditorStore = create<EditorState>((set, get) => {
  /** Push applied patches onto history. */
  const commit = (patches: Patch[], key?: string) => {
    if (!patches.length) return
    const { undoStack } = get()
    const last = undoStack[undoStack.length - 1]
    let stack: HistoryEntry[]
    if (key && last && last.key === key && Date.now() - last.ts < 1500) {
      const merged = mergeAll([...last.patches, ...patches])
      stack = merged.length ? [...undoStack.slice(0, -1), { patches: merged, key, ts: Date.now() }] : undoStack.slice(0, -1)
    } else {
      stack = [...undoStack, { patches, key, ts: Date.now() }]
    }
    set((s) => ({ undoStack: stack, redoStack: [], patches: derive(stack), revision: s.revision + 1 }))
  }

  /** After the DOM changed under us (undo/redo/reload), re-resolve the selected element by id. */
  const resolveSelection = () => {
    const doc = canvas.doc
    const { selectedTwId, selectedEl } = get()
    if (!doc) return
    let el: HTMLElement | null = null
    if (selectedTwId) el = selectedTwId === 'tw-0' ? doc.body : findByTwId(doc, selectedTwId)
    else if (selectedEl?.isConnected) el = selectedEl
    canvas.setSelected(el)
    set({ selectedEl: el, selectedTwId: twIdOf(el) })
  }

  return {
    ...initial,
    viewportWidth: 'full',
    iframeKey: 0,

    loadFile: (name, html) => {
      const { preparedHtml, isFragment } = prepareHtml(html)
      set((s) => ({ ...initial, fileName: name, originalHtml: html, preparedHtml, isFragment, iframeKey: s.iframeKey + 1 }))
    },

    closeFile: () => {
      canvas.detach()
      set({ ...initial })
    },

    setMode: (mode) => {
      canvas.setMode(mode)
      if (mode === 'play') {
        canvas.setSelected(null)
        set({ mode, selectedEl: null, selectedTwId: null, hoveredTwId: null })
      } else set({ mode })
    },
    toggleMode: () => get().setMode(get().mode === 'play' ? 'edit' : 'play'),

    select: (el) => {
      if (el && el.tagName === 'HTML') el = null
      canvas.setSelected(el)
      set({ selectedEl: el, selectedTwId: twIdOf(el) })
    },
    setHovered: (el) => set({ hoveredTwId: twIdOf(el) }),
    selectParent: () => {
      const el = get().selectedEl
      const parent = el?.parentElement
      if (parent && parent.tagName !== 'HTML') get().select(parent)
    },

    setStyle: (props, coalesceKey) => {
      const el = get().selectedEl
      if (!el?.isConnected) return
      const { key, ...target } = targetOf(el)
      const runtime = !target.twId
      const doc = el.ownerDocument
      const win = doc.defaultView!
      const patches: StylePatch[] = []
      for (const [prop, value] of Object.entries(props)) {
        const cur = runtime ? readRuleValue(doc, target.selector!, prop) : { value: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop) }
        const before = cur.value
        const beforePriority = cur.priority
        if (before === value) continue
        const from = displayValue(el, prop)
        const computedBefore = win.getComputedStyle(el).getPropertyValue(prop)
        const patch: StylePatch = { id: newPatchId(), ...target, kind: 'style', prop, before, after: value, beforePriority, important: false, from }
        applyPatch(doc, patch)
        // A stylesheet rule with !important (or, for rules, an inline style) beats us → retry with !important
        if (value !== '' && win.getComputedStyle(el).getPropertyValue(prop) === computedBefore) {
          applyPatch(doc, { ...patch, important: true })
          if (win.getComputedStyle(el).getPropertyValue(prop) !== computedBefore) patch.important = true
          else applyPatch(doc, patch)
        }
        if (!runtime && !el.getAttribute('style')) el.removeAttribute('style')
        patch.to = displayValue(el, prop)
        patches.push(patch)
      }
      commit(patches, coalesceKey && `${key}|${coalesceKey}`)
    },

    setText: (el, before, after, html, alreadyApplied, coalesceKey) => {
      if (before === after) return
      const { key, ...target } = targetOf(el)
      const patch: Patch = { id: newPatchId(), ...target, kind: 'text', before, after, html }
      if (!alreadyApplied && canvas.doc) applyPatch(canvas.doc, patch)
      commit([patch], coalesceKey && `${key}|${coalesceKey}`)
    },

    removeSelected: () => {
      const { selectedEl: el, selectedTwId: twId } = get()
      if (!el) return
      // Script-rendered element: it can't be removed from the source → hide it with a CSS rule instead
      if (!twId) {
        get().setStyle({ display: 'none' })
        canvas.setSelected(null)
        set({ selectedEl: null, selectedTwId: null })
        return get().notify('Rendered by script — hidden with a CSS rule (display: none)')
      }
      if (el.tagName === 'BODY') return get().notify('Cannot delete <body>')
      const parent = el.parentElement
      const parentTwId = twIdOf(parent)
      if (!parent || !parentTwId) return get().notify('Parent element was created by script — cannot delete here')
      const patch: NewPatch = { twId, kind: 'remove', outerHTML: el.outerHTML, parentTwId, index: Array.from(parent.children).indexOf(el) }
      el.remove()
      canvas.setSelected(null)
      set({ selectedEl: null, selectedTwId: null })
      commit([{ ...patch, id: newPatchId() }])
    },

    toggleHidden: () => {
      const el = get().selectedEl
      if (!el) return
      const t = targetOf(el)
      const own = t.twId ? el.style.getPropertyValue('display') : readRuleValue(el.ownerDocument, t.selector!, 'display').value
      const hidden = own === 'none'
      get().setStyle({ display: hidden ? '' : 'none' })
    },

    undo: () => {
      const { undoStack, redoStack } = get()
      const entry = undoStack[undoStack.length - 1]
      const doc = canvas.doc
      if (!entry || !doc) return
      for (const p of [...entry.patches].reverse()) revertPatch(doc, p)
      const stack = undoStack.slice(0, -1)
      set((s) => ({ undoStack: stack, redoStack: [...redoStack, entry], patches: derive(stack), revision: s.revision + 1 }))
      resolveSelection()
    },

    redo: () => {
      const { undoStack, redoStack } = get()
      const entry = redoStack[redoStack.length - 1]
      const doc = canvas.doc
      if (!entry || !doc) return
      for (const p of entry.patches) applyPatch(doc, p)
      const stack = [...undoStack, { ...entry, key: undefined }]
      set((s) => ({ undoStack: stack, redoStack: redoStack.slice(0, -1), patches: derive(stack), revision: s.revision + 1 }))
      resolveSelection()
    },

    resetPreview: () => set((s) => ({ iframeKey: s.iframeKey + 1 })),

    /** iframe (re)loaded: re-apply every patch to the fresh live DOM. */
    onCanvasLoad: () => {
      const doc = canvas.doc
      if (!doc) return
      for (const p of get().patches) applyPatch(doc, p)
      canvas.setMode(get().mode)
      resolveSelection()
      set((s) => ({ revision: s.revision + 1 }))
    },

    setViewport: (viewportWidth) => set({ viewportWidth }),

    notify: (text) => set({ notice: { text, id: Date.now() } }),
  }
})

if (import.meta.env.DEV) (window as unknown as { __store: typeof useEditorStore }).__store = useEditorStore
