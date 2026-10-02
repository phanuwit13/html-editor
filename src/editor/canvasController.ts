import { shortLabel } from './selector'

export interface CanvasCallbacks {
  onHover: (el: HTMLElement | null) => void
  onSelect: (el: HTMLElement | null) => void
  onTextCommit: (el: HTMLElement, before: string, after: string, html: boolean) => void
  /** return true when the key was handled (it will be preventDefault-ed) */
  onKey: (e: KeyboardEvent) => boolean
  onNotice: (text: string) => void
}

const BLOCKED_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'submit', 'touchstart', 'touchend', 'dragstart'] as const

/** Elements whose content can be edited inline as rich text (only inline children allowed). */
const INLINE_TAGS = new Set(['A', 'ABBR', 'B', 'BR', 'CODE', 'EM', 'I', 'KBD', 'MARK', 'S', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'U', 'TIME', 'LABEL'])
const NON_TEXT_TAGS = new Set(['IMG', 'INPUT', 'SELECT', 'TEXTAREA', 'VIDEO', 'AUDIO', 'CANVAS', 'SVG', 'IFRAME', 'HR', 'BODY', 'HTML'])

const isEditableTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
}

export function canEditText(el: HTMLElement): { ok: boolean; html: boolean } {
  if (NON_TEXT_TAGS.has(el.tagName.toUpperCase())) return { ok: false, html: false }
  const descendants = Array.from(el.querySelectorAll('*'))
  if (descendants.some((d) => !INLINE_TAGS.has(d.tagName))) return { ok: false, html: false }
  if (!el.textContent?.trim() && descendants.length === 0 && el.children.length === 0) return { ok: true, html: false }
  return { ok: true, html: descendants.length > 0 }
}

/**
 * Owns everything that happens *inside* the iframe in Edit mode: capture-phase event blocking,
 * hover/select overlay drawing and inline text editing. Accesses the iframe directly
 * (allow-same-origin) — no postMessage bridge.
 */
export class CanvasController {
  iframe: HTMLIFrameElement | null = null
  private cb: CanvasCallbacks | null = null
  private mode: 'play' | 'edit' = 'play'
  private hovered: HTMLElement | null = null
  private selected: HTMLElement | null = null
  private editing: { el: HTMLElement; before: string; html: boolean } | null = null
  private raf = 0
  private cleanup: (() => void)[] = []

  get doc(): Document | null {
    try {
      return this.iframe?.contentDocument ?? null
    } catch {
      return null
    }
  }
  get win(): Window | null {
    return this.iframe?.contentWindow ?? null
  }

  setCallbacks(cb: CanvasCallbacks) {
    this.cb = cb
  }

  /** Called on every iframe load. */
  attach(iframe: HTMLIFrameElement) {
    this.detach()
    this.iframe = iframe
    const win = this.win
    if (!win) return
    const onKey = (e: KeyboardEvent) => this.handleKey(e)
    const onPlayClick = (e: MouseEvent) => this.guardNavigation(e)
    const onPlaySubmit = (e: Event) => {
      if (this.mode === 'play' && !e.defaultPrevented) {
        e.preventDefault()
        this.cb?.onNotice('Form submitted (navigation is disabled in the preview)')
      }
    }
    win.addEventListener('keydown', onKey, true)
    win.addEventListener('click', onPlayClick)
    win.addEventListener('submit', onPlaySubmit)
    this.cleanup.push(() => {
      win.removeEventListener('keydown', onKey, true)
      win.removeEventListener('click', onPlayClick)
      win.removeEventListener('submit', onPlaySubmit)
    })
  }

  detach() {
    this.stopEdit()
    this.cleanup.forEach((f) => f())
    this.cleanup = []
    this.hovered = null
    this.selected = null
    this.editing = null
    this.iframe = null
  }

  setMode(mode: 'play' | 'edit') {
    this.mode = mode
    if (mode === 'edit') this.startEdit()
    else this.stopEdit()
  }

  setSelected(el: HTMLElement | null) {
    if (this.editing && this.editing.el !== el) this.commitText()
    this.selected = el
  }

  // ---------------------------------------------------------------- edit mode

  private editCleanup: (() => void) | null = null

  private startEdit() {
    const win = this.win
    const doc = this.doc
    if (!win || !doc || this.editCleanup) return
    this.ensureOverlay()
    doc.documentElement.classList.add('__tw_editing')

    const block = (e: Event) => {
      if (this.editing && this.editing.el.contains(e.target as Node)) return // let caret placement work
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.type === 'mousedown' && this.editing) this.commitText()
      if (e.type === 'click') this.cb?.onSelect(this.pick(e.target))
      // Chrome may not fire `dblclick` when mousedown is prevented → also use click.detail
      if (e.type === 'dblclick' || (e.type === 'click' && (e as MouseEvent).detail === 2)) {
        const el = this.pick(e.target)
        if (el) {
          this.cb?.onSelect(el)
          this.startTextEdit(el)
        }
      }
    }
    const move = (e: MouseEvent) => {
      const el = this.pick(e.target)
      if (el !== this.hovered) {
        this.hovered = el
        this.cb?.onHover(el)
      }
    }
    const leave = () => {
      this.hovered = null
      this.cb?.onHover(null)
    }

    BLOCKED_EVENTS.forEach((t) => win.addEventListener(t, block, true))
    win.addEventListener('mousemove', move, true)
    doc.documentElement.addEventListener('mouseleave', leave)

    const loop = () => {
      this.draw()
      this.raf = win.requestAnimationFrame(loop)
    }
    this.raf = win.requestAnimationFrame(loop)

    this.editCleanup = () => {
      BLOCKED_EVENTS.forEach((t) => win.removeEventListener(t, block, true))
      win.removeEventListener('mousemove', move, true)
      doc.documentElement.removeEventListener('mouseleave', leave)
      win.cancelAnimationFrame(this.raf)
      doc.documentElement.classList.remove('__tw_editing')
    }
  }

  private stopEdit() {
    if (this.editing) this.commitText()
    this.editCleanup?.()
    this.editCleanup = null
    this.hovered = null
    this.hideOverlay()
  }

  private pick(target: EventTarget | null): HTMLElement | null {
    let el = target as HTMLElement | null
    if (el && el.nodeType !== 1) el = (el as unknown as Node).parentElement
    if (!el || el.tagName === 'HTML' || el.id?.startsWith('__tw_')) return null
    // SVG internals → select the <svg> itself
    const svg = el.closest?.('svg')
    if (svg) el = svg as unknown as HTMLElement
    return el
  }

  // ---------------------------------------------------------------- keys / navigation

  private handleKey(e: KeyboardEvent) {
    if (this.editing) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.commitText()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        this.cancelText()
      }
      return
    }
    if (this.mode === 'play' && isEditableTarget(e.target)) return
    if (this.cb?.onKey(e)) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }

  /** Play mode: links to other pages cannot work inside srcdoc — keep the user on this page. */
  private guardNavigation(e: MouseEvent) {
    if (this.mode !== 'play' || e.defaultPrevented) return
    const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute('href') ?? ''
    if (href.startsWith('#') || href.startsWith('javascript:')) return
    e.preventDefault()
    this.cb?.onNotice(`Link to "${href}" — navigation is disabled (single-file editor)`)
  }

  // ---------------------------------------------------------------- inline text editing

  startTextEdit(el: HTMLElement) {
    if (this.mode !== 'edit') return
    const { ok, html } = canEditText(el)
    if (!ok) {
      this.cb?.onNotice('This element contains other blocks — select a text element inside it')
      return
    }
    if (this.editing?.el === el) return
    if (this.editing) this.commitText()
    this.editing = { el, before: html ? el.innerHTML : (el.textContent ?? ''), html }
    el.setAttribute('contenteditable', html ? 'true' : 'plaintext-only')
    if (!el.isContentEditable) el.setAttribute('contenteditable', 'true')
    el.focus()
    const sel = this.win?.getSelection()
    const range = this.doc?.createRange()
    if (sel && range) {
      range.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    const onBlur = () => this.commitText()
    el.addEventListener('blur', onBlur, { once: true })
  }

  get isEditingText() {
    return !!this.editing
  }

  commitText() {
    const ed = this.editing
    if (!ed) return
    this.editing = null
    ed.el.removeAttribute('contenteditable')
    this.win?.getSelection()?.removeAllRanges()
    const after = ed.html ? ed.el.innerHTML : (ed.el.textContent ?? '')
    if (after !== ed.before) this.cb?.onTextCommit(ed.el, ed.before, after, ed.html)
  }

  cancelText() {
    const ed = this.editing
    if (!ed) return
    this.editing = null
    if (ed.html) ed.el.innerHTML = ed.before
    else ed.el.textContent = ed.before
    ed.el.removeAttribute('contenteditable')
    this.win?.getSelection()?.removeAllRanges()
  }

  // ---------------------------------------------------------------- overlay

  private overlay(id: string): HTMLElement | null {
    return this.doc?.getElementById(id) ?? null
  }

  /** Overlay lives inside the iframe; recreate it if the page script wiped the DOM. */
  private ensureOverlay() {
    const doc = this.doc
    if (!doc) return
    for (const id of ['__tw_margin', '__tw_padding', '__tw_hover', '__tw_select', '__tw_label']) {
      if (doc.getElementById(id)) continue
      const d = doc.createElement('div')
      d.id = id
      if (id === '__tw_select') {
        for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const h = doc.createElement('i')
          h.style.cssText = `${x ? 'right' : 'left'}:-4px;${y ? 'bottom' : 'top'}:-4px`
          d.appendChild(h)
        }
      }
      doc.documentElement.appendChild(d)
    }
  }

  private hideOverlay() {
    for (const id of ['__tw_margin', '__tw_padding', '__tw_hover', '__tw_select', '__tw_label']) {
      const el = this.overlay(id)
      if (el) el.style.display = 'none'
    }
  }

  private place(box: HTMLElement | null, r: { left: number; top: number; width: number; height: number }) {
    if (!box) return
    box.style.display = 'block'
    box.style.transform = `translate(${r.left}px, ${r.top}px)`
    box.style.width = `${Math.max(0, r.width)}px`
    box.style.height = `${Math.max(0, r.height)}px`
  }

  private draw() {
    const doc = this.doc
    const win = this.win
    if (!doc || !win) return
    if (!doc.getElementById('__tw_select')) this.ensureOverlay()

    const hoverBox = this.overlay('__tw_hover')
    const selBox = this.overlay('__tw_select')
    const marginBox = this.overlay('__tw_margin')
    const padBox = this.overlay('__tw_padding')
    const label = this.overlay('__tw_label')

    const h = this.hovered
    if (h && h.isConnected && h !== this.selected) this.place(hoverBox, h.getBoundingClientRect())
    else if (hoverBox) hoverBox.style.display = 'none'

    const s = this.selected
    if (!s || !s.isConnected) {
      for (const b of [selBox, marginBox, padBox]) if (b) b.style.display = 'none'
    } else {
      const r = s.getBoundingClientRect()
      const cs = win.getComputedStyle(s)
      const n = (p: string) => parseFloat(cs.getPropertyValue(p)) || 0
      const m = { t: n('margin-top'), r: n('margin-right'), b: n('margin-bottom'), l: n('margin-left') }
      const bw = { t: n('border-top-width'), r: n('border-right-width'), b: n('border-bottom-width'), l: n('border-left-width') }
      const p = { t: n('padding-top'), r: n('padding-right'), b: n('padding-bottom'), l: n('padding-left') }
      this.place(selBox, r)
      if (marginBox) {
        this.place(marginBox, { left: r.left - Math.max(0, m.l), top: r.top - Math.max(0, m.t), width: r.width + Math.max(0, m.l) + Math.max(0, m.r), height: r.height + Math.max(0, m.t) + Math.max(0, m.b) })
        marginBox.style.borderWidth = `${Math.max(0, m.t)}px ${Math.max(0, m.r)}px ${Math.max(0, m.b)}px ${Math.max(0, m.l)}px`
      }
      if (padBox) {
        this.place(padBox, { left: r.left + bw.l, top: r.top + bw.t, width: r.width - bw.l - bw.r, height: r.height - bw.t - bw.b })
        padBox.style.borderWidth = `${p.t}px ${p.r}px ${p.b}px ${p.l}px`
      }
    }

    const target = s && s.isConnected ? s : h && h.isConnected ? h : null
    if (label) {
      if (!target) label.style.display = 'none'
      else {
        const r = target.getBoundingClientRect()
        const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        const text = `${esc(shortLabel(target))}<span>${Math.round(r.width)} × ${Math.round(r.height)}</span>`
        if (label.innerHTML !== text) label.innerHTML = text
        label.style.display = 'block'
        const top = r.top - 20 < 0 ? r.bottom + 4 : r.top - 20
        const left = Math.min(Math.max(0, r.left), win.innerWidth - label.offsetWidth - 4)
        label.style.transform = `translate(${left}px, ${top}px)`
      }
    }
  }
}

export const canvas = new CanvasController()
