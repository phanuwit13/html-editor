import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, Frame, Image, List, MousePointerClick, Square, Table, TextCursorInput, Type, Video } from 'lucide-react'
import { useEditorStore } from '../store/useEditorStore'
import { canvas } from '../editor/canvasController'
import { shortLabel } from '../editor/selector'
import { TW_ATTR } from '../editor/patches'
import { cn } from '../lib/cn'

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META'])
const TEXT_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'LABEL', 'STRONG', 'EM', 'B', 'I', 'SMALL', 'CODE', 'BLOCKQUOTE', 'LI', 'TD', 'TH', 'FIGCAPTION', 'SUMMARY', 'LEGEND', 'TIME', 'MARK'])
const MEDIA_TAGS = new Set(['IMG', 'SVG', 'PICTURE', 'CANVAS'])
const FIELD_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])
/** Don't descend into these — the canvas selects them as a whole. */
const LEAF_TAGS = new Set(['SVG', 'PICTURE', 'SELECT', 'VIDEO', 'AUDIO', 'IFRAME', 'CANVAS'])

const MAX_ROWS = 2000
/** Nodes at depth <= this are expanded unless the user collapsed them (body = depth 0). */
const DEFAULT_EXPAND_DEPTH = 2
const THROTTLE_MS = 150

const isOverlay = (el: Element) => !!el.id && el.id.startsWith('__tw_')
const keep = (el: Element) => !SKIP_TAGS.has(el.tagName.toUpperCase()) && !isOverlay(el)
const tagOf = (el: Element) => el.tagName.toUpperCase()

function visibleChildren(el: Element): Element[] {
  if (LEAF_TAGS.has(tagOf(el))) return []
  const out: Element[] = []
  for (const c of Array.from(el.children)) if (keep(c)) out.push(c)
  return out
}

function ownText(el: Element): string {
  let t = ''
  for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) t += n.textContent ?? ''
  t = t.replace(/\s+/g, ' ').trim()
  return t.length > 24 ? `${t.slice(0, 24)}…` : t
}

function iconFor(el: Element, hasKids: boolean): LucideIcon {
  const tag = tagOf(el)
  if (MEDIA_TAGS.has(tag)) return Image
  if (tag === 'VIDEO') return Video
  if (tag === 'BUTTON') return MousePointerClick
  if (FIELD_TAGS.has(tag)) return TextCursorInput
  if (tag === 'UL' || tag === 'OL') return List
  if (tag === 'TABLE') return Table
  if (TEXT_TAGS.has(tag) && !hasKids) return Type
  if (hasKids || tag === 'BODY') return Frame
  return Square
}

function isHidden(el: Element): boolean {
  try {
    return el.ownerDocument.defaultView?.getComputedStyle(el).display === 'none'
  } catch {
    return false
  }
}

interface Row {
  el: Element
  depth: number
  hasKids: boolean
  expanded: boolean
  label: string
  preview: string
  script: boolean
  hidden: boolean
}

/** Should this mutation make us re-render? Filters out our overlay, rules stylesheet and inline-edit noise. */
function relevant(m: MutationRecord): boolean {
  const target = m.target as Node
  const el = (target.nodeType === 1 ? target : target.parentElement) as Element | null
  if (!el) return false
  const doc = el.ownerDocument
  if (el === doc.documentElement && m.type === 'attributes') return false // __tw_editing class
  if (doc.head && doc.head.contains(el)) return false
  if (el.closest('[id^="__tw_"]') || el.closest('[contenteditable]')) return false
  if (m.type === 'attributes') return m.attributeName !== 'contenteditable'
  const nodes = [...Array.from(m.addedNodes), ...Array.from(m.removedNodes)]
  if (!nodes.length) return false
  return nodes.some((n) => !(n.nodeType === 1 && isOverlay(n as Element)))
}

export default function LayersPanel() {
  const iframeKey = useEditorStore((s) => s.iframeKey)
  const revision = useEditorStore((s) => s.revision)
  const selectedEl = useEditorStore((s) => s.selectedEl)
  const hoveredEl = useEditorStore((s) => s.hoveredEl)
  const [tick, bump] = useReducer((n: number) => n + 1, 0)

  /** explicit user choice per element; absent → default by depth */
  const expandedRef = useRef<WeakMap<Element, boolean>>(new WeakMap())
  const observedDoc = useRef<Document | null>(null)
  const observer = useRef<MutationObserver | null>(null)
  const timer = useRef<number | null>(null)
  const selRowRef = useRef<HTMLDivElement | null>(null)
  const lastScrolled = useRef<Element | null>(null)

  const doc = canvas.doc
  const body = doc?.body ?? null

  // (Re-)attach the MutationObserver whenever the iframe document changes.
  useEffect(() => {
    const d = canvas.doc
    if (d === observedDoc.current) return
    observer.current?.disconnect()
    observer.current = null
    observedDoc.current = d
    if (!d?.documentElement) return
    const win = d.defaultView as (Window & typeof globalThis) | null
    if (!win) return
    const mo = new win.MutationObserver((list) => {
      if (timer.current !== null || !list.some(relevant)) return
      timer.current = window.setTimeout(() => {
        timer.current = null
        bump()
      }, THROTTLE_MS)
    })
    mo.observe(d.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'id'] })
    observer.current = mo
    bump()
  }, [iframeKey, revision])

  useEffect(
    () => () => {
      observer.current?.disconnect()
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const isExpanded = (el: Element, depth: number) => expandedRef.current.get(el) ?? depth <= DEFAULT_EXPAND_DEPTH

  // Selection changed → expand all its ancestors so the row exists.
  if (selectedEl && body && selectedEl !== lastScrolled.current && body.contains(selectedEl)) {
    let p = selectedEl.parentElement
    while (p && p !== body.parentElement) {
      expandedRef.current.set(p, true)
      if (p === body) break
      p = p.parentElement
    }
  }

  const { rows, truncated, total } = useMemo(() => {
    const rows: Row[] = []
    let truncated = false
    let total = 0
    if (!body) return { rows, truncated, total }
    const walk = (el: Element, depth: number, render: boolean) => {
      total++
      const kids = visibleChildren(el)
      const expanded = kids.length > 0 && isExpanded(el, depth)
      if (render) {
        if (rows.length >= MAX_ROWS) truncated = true
        else
          rows.push({
            el,
            depth,
            hasKids: kids.length > 0,
            expanded,
            label: shortLabel(el),
            preview: kids.length ? '' : ownText(el),
            script: !el.hasAttribute(TW_ATTR),
            hidden: isHidden(el),
          })
      }
      for (const k of kids) walk(k, depth + 1, render && expanded && !truncated)
    }
    walk(body, 0, true)
    return { rows, truncated, total }
    // tick covers expansion toggles + observed mutations; revision/iframeKey cover our own edits/reloads
  }, [body, tick, revision, iframeKey, selectedEl])

  // Scroll the selected row into view when selection changes.
  useEffect(() => {
    if (selectedEl === lastScrolled.current) return
    lastScrolled.current = selectedEl
    selRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedEl, rows])

  const toggle = (el: Element, depth: number) => {
    expandedRef.current.set(el, !isExpanded(el, depth))
    bump()
  }

  const onPick = (el: Element) => {
    const st = useEditorStore.getState()
    if (st.mode === 'play') st.setMode('edit')
    st.select(el as HTMLElement)
    canvas.reveal(el as HTMLElement)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-neutral-200 px-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Layers</h3>
        {body && <span className="text-[10px] tabular-nums text-neutral-400">{total.toLocaleString()}</span>}
      </div>
      {!body ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-[11px] text-neutral-400">No document loaded</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto py-1" onMouseLeave={() => useEditorStore.getState().setHovered(null, true)}>
          {rows.map((r) => {
            const Icon = iconFor(r.el, r.hasKids)
            const selected = r.el === selectedEl
            const hovered = !selected && r.el === hoveredEl
            return (
              <div
                key={rowKey(r.el)}
                ref={selected ? selRowRef : undefined}
                onClick={() => onPick(r.el)}
                onMouseEnter={() => useEditorStore.getState().setHovered(r.el as HTMLElement, true)}
                onMouseLeave={() => useEditorStore.getState().setHovered(null, true)}
                style={{ paddingLeft: 4 + r.depth * 12 }}
                className={cn(
                  'flex h-6 cursor-default select-none items-center gap-1 whitespace-nowrap pr-2 text-[11px] text-neutral-700',
                  selected ? 'bg-sky-100 text-sky-900' : hovered ? 'bg-neutral-100' : 'hover:bg-neutral-100',
                  r.hidden && 'opacity-45',
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {r.hasKids && (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={r.expanded ? 'Collapse' : 'Expand'}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggle(r.el, r.depth)
                      }}
                      className="flex size-4 items-center justify-center rounded text-neutral-400 hover:text-neutral-700"
                    >
                      <ChevronRight className={cn('size-3 transition-transform', r.expanded && 'rotate-90')} />
                    </button>
                  )}
                </span>
                <Icon className={cn('size-3.5 shrink-0', selected ? 'text-sky-600' : 'text-neutral-400')} />
                <span className={cn('truncate', r.script && 'italic')}>{r.label}</span>
                {r.script && <span title="Rendered by script" className="size-1.5 shrink-0 rounded-full bg-amber-400" />}
                {r.preview && <span className={cn('min-w-0 truncate', selected ? 'text-sky-700/60' : 'text-neutral-400')}>{r.preview}</span>}
              </div>
            )
          })}
          {truncated && <div className="px-3 py-1.5 text-[11px] text-neutral-400">…more (collapse some layers to see the rest)</div>}
        </div>
      )}
    </div>
  )
}

/** Stable React keys per live element (elements are not serialisable). */
const keys = new WeakMap<Element, number>()
let keySeq = 0
function rowKey(el: Element): number {
  let k = keys.get(el)
  if (k === undefined) keys.set(el, (k = ++keySeq))
  return k
}
