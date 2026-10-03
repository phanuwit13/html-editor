export type Side = 'top' | 'right' | 'bottom' | 'left'

/**
 * Elements rendered by the page's own script (SPA/Preact/React prototypes) have no data-tw-id.
 * Their edits target a structural CSS `selector` instead: styles become rules in a stylesheet
 * (survives re-renders and can be exported), text is live-only + reported in the change list.
 */
export type RuntimeTarget = {
  /** '' when the patch targets `selector` */
  twId: string
  selector?: string
  /** readable name for the change list */
  label?: string
}

export type StylePatch = RuntimeTarget & {
  id: string
  kind: 'style'
  prop: string
  /** previous inline value ('' = none) — used for exact undo */
  before: string
  after: string
  beforePriority?: string
  /** applied with !important because a stylesheet rule beat the inline style */
  important?: boolean
  /** human-readable (computed) values for the change list */
  from?: string
  to?: string
}
export type TextPatch = RuntimeTarget & { id: string; kind: 'text'; before: string; after: string; html?: boolean }
export type AttrPatch = { id: string; twId: string; kind: 'attr'; name: string; before: string | null; after: string | null }
export type RemovePatch = { id: string; twId: string; kind: 'remove'; outerHTML: string; parentTwId: string; index: number }
/** Duplicate: `outerHTML` (with fresh data-tw-ids, root = twId) inserted at `index` of the parent. */
export type InsertPatch = { id: string; twId: string; kind: 'insert'; outerHTML: string; parentTwId: string; index: number; sourceTwId: string }

export type Patch = StylePatch | TextPatch | AttrPatch | RemovePatch | InsertPatch
type StructuralPatch = RemovePatch | InsertPatch
export type NewPatch = Patch extends infer P ? (P extends Patch ? Omit<P, 'id'> : never) : never

let seq = 0
export const newPatchId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`

export const TW_ATTR = 'data-tw-id'

export function findByTwId(doc: Document, twId: string): HTMLElement | null {
  return doc.querySelector(`[${TW_ATTR}="${twId}"]`)
}

export const isRuntimePatch = (p: Patch): p is (StylePatch | TextPatch) & { selector: string } =>
  (p.kind === 'style' || p.kind === 'text') && !!p.selector

export const targetKey = (p: Patch) => (isRuntimePatch(p) ? `sel:${p.selector}` : p.twId)

export const RULES_STYLE_ID = '__tw_rules'

/** Live-only stylesheet holding rules for script-rendered elements (export regenerates it from patches). */
function ruleFor(doc: Document, selector: string): CSSStyleRule | null {
  let style = doc.getElementById(RULES_STYLE_ID) as (HTMLStyleElement & { __rules?: Map<string, CSSStyleRule> }) | null
  if (!style) {
    style = doc.createElement('style')
    style.id = RULES_STYLE_ID
    doc.head.appendChild(style)
  } else if (style.nextElementSibling) {
    doc.head.appendChild(style) // keep it last so equal-specificity page rules can't win
  }
  const sheet = style.sheet
  if (!sheet) return null
  style.__rules ??= new Map()
  let rule = style.__rules.get(selector)
  if (!rule) {
    try {
      rule = sheet.cssRules[sheet.insertRule(`${selector} {}`, sheet.cssRules.length)] as CSSStyleRule
    } catch {
      return null
    }
    style.__rules.set(selector, rule)
  }
  return rule
}

export function readRuleValue(doc: Document, selector: string, prop: string) {
  const rule = ruleFor(doc, selector)
  return { value: rule?.style.getPropertyValue(prop) ?? '', priority: rule?.style.getPropertyPriority(prop) ?? '' }
}

/** Apply a patch to a document (live iframe document or a DOMParser export document). */
export function applyPatch(doc: Document, patch: Patch) {
  if (isRuntimePatch(patch)) {
    if (patch.kind === 'style') {
      const rule = ruleFor(doc, patch.selector)
      if (!rule) return
      if (patch.after === '') rule.style.removeProperty(patch.prop)
      else rule.style.setProperty(patch.prop, patch.after, patch.important ? 'important' : '')
    } else {
      const el = doc.querySelector<HTMLElement>(patch.selector)
      if (!el) return
      if (patch.html) el.innerHTML = patch.after
      else el.textContent = patch.after
    }
    return
  }
  if (patch.kind === 'insert') {
    if (!findByTwId(doc, patch.twId)) insertHtml(doc, patch.parentTwId, patch.index, patch.outerHTML)
    return
  }
  const el = findByTwId(doc, patch.twId)
  if (!el) return
  switch (patch.kind) {
    case 'style':
      if (patch.after === '') el.style.removeProperty(patch.prop)
      else el.style.setProperty(patch.prop, patch.after, patch.important ? 'important' : '')
      if (!el.getAttribute('style')) el.removeAttribute('style')
      break
    case 'text':
      if (patch.html) el.innerHTML = patch.after
      else el.textContent = patch.after
      break
    case 'attr':
      if (patch.after === null) el.removeAttribute(patch.name)
      else el.setAttribute(patch.name, patch.after)
      break
    case 'remove':
      el.remove()
      break
  }
}

function parentOf(doc: Document, parentTwId: string) {
  return findByTwId(doc, parentTwId) ?? (parentTwId === 'tw-0' ? doc.body : null)
}

function insertHtml(doc: Document, parentTwId: string, index: number, html: string) {
  const parent = parentOf(doc, parentTwId)
  if (!parent) return
  const tpl = doc.createElement('template')
  tpl.innerHTML = html
  const node = tpl.content.firstElementChild
  if (node) parent.insertBefore(node, parent.children[index] ?? null)
}

/** Undo a patch on the live document. */
export function revertPatch(doc: Document, patch: Patch) {
  if (patch.kind === 'remove') return insertHtml(doc, patch.parentTwId, patch.index, patch.outerHTML)
  if (patch.kind === 'insert') return findByTwId(doc, patch.twId)?.remove()
  applyPatch(doc, invertPatch(patch))
}

export function invertPatch<P extends Exclude<Patch, StructuralPatch>>(patch: P): P {
  if (patch.kind === 'style') {
    return {
      ...patch,
      before: patch.after,
      after: patch.before,
      important: patch.beforePriority === 'important',
      from: patch.to,
      to: patch.from,
    }
  }
  return { ...patch, before: patch.after, after: patch.before }
}

function sameTarget(a: Patch, b: Patch) {
  if (targetKey(a) !== targetKey(b) || a.kind !== b.kind) return false
  if (a.kind === 'style' && b.kind === 'style') return a.prop === b.prop
  if (a.kind === 'attr' && b.kind === 'attr') return a.name === b.name
  return a.kind === 'text'
}

function isNoop(p: Patch) {
  if (p.kind === 'remove' || p.kind === 'insert') return false
  if (p.kind === 'style') return p.before === p.after && !p.important === (p.beforePriority !== 'important')
  return p.before === p.after
}

/**
 * Merge a patch into a list: repeated edits of the same prop on the same element collapse
 * into one patch (first `before`, latest `after`). Edits that cancel out are dropped.
 */
export function mergePatch(list: Patch[], patch: Patch): Patch[] {
  if (patch.kind !== 'remove' && patch.kind !== 'insert') {
    const i = list.findIndex((p) => sameTarget(p, patch))
    if (i !== -1) {
      const prev = list[i] as Exclude<Patch, StructuralPatch>
      const merged = { ...patch, id: prev.id, before: prev.before } as Patch
      if (merged.kind === 'style' && prev.kind === 'style') {
        merged.beforePriority = prev.beforePriority
        merged.from = prev.from
      }
      const next = list.slice()
      if (isNoop(merged)) next.splice(i, 1)
      else next[i] = merged
      return next
    }
  }
  if (isNoop(patch)) return list
  return [...list, patch]
}

export function mergeAll(patches: Patch[]): Patch[] {
  return patches.reduce<Patch[]>((acc, p) => mergePatch(acc, p), [])
}
