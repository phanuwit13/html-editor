import { findByTwId, TW_ATTR, applyPatch, isRuntimePatch, targetKey, type Patch, type StylePatch } from './patches'
import { OVERLAY_CSS_ID, serialize } from './prepareHtml'
import { readableSelector } from './selector'
import { SIDES, CORNERS } from './styleReader'

export interface ChangeItem {
  selector: string
  change: string
}

const truncate = (s: string, n = 60) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}
const stripTags = (html: string) => {
  const d = new DOMParser().parseFromString(html, 'text/html')
  return d.body.textContent ?? ''
}
const val = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback || '(none)')

/** padding-top/right/bottom/left → "padding: 12px 20px" style shorthand. */
function shorthand(values: string[]) {
  const [t, r, b, l] = values
  if (t === r && r === b && b === l) return t
  if (t === b && r === l) return `${t} ${r}`
  if (r === l) return `${t} ${r} ${b}`
  return values.join(' ')
}

const GROUPS: { name: string; props: string[] }[] = [
  { name: 'padding', props: SIDES.map((s) => `padding-${s}`) },
  { name: 'margin', props: SIDES.map((s) => `margin-${s}`) },
  { name: 'border-radius', props: CORNERS.map((c) => `border-${c}-radius`) },
]

/** Build the list of human-readable changes, selectors resolved against the original document. */
export function buildChangeList(preparedHtml: string, patches: Patch[]): ChangeItem[] {
  const original = new DOMParser().parseFromString(preparedHtml, 'text/html')
  const selectorFor = (twId: string) => {
    const el = twId === 'tw-0' ? original.body : findByTwId(original, twId)
    return el ? readableSelector(el) : `[element ${twId}]`
  }

  const items: ChangeItem[] = []
  const consumed = new Set<string>()

  for (const p of patches) {
    if (consumed.has(p.id)) continue
    const runtime = isRuntimePatch(p)
    const selector = runtime ? (p.label ?? p.selector) : selectorFor(p.twId)

    if (p.kind === 'style') {
      const group = GROUPS.find((g) => g.props.includes(p.prop))
      if (group) {
        const members = group.props.map(
          (prop) => patches.find((q) => q.kind === 'style' && targetKey(q) === targetKey(p) && q.prop === prop) as StylePatch | undefined,
        )
        if (members.every(Boolean)) {
          members.forEach((m) => consumed.add(m!.id))
          const from = shorthand(members.map((m) => val(m!.from, m!.before)))
          const to = shorthand(members.map((m) => val(m!.to, m!.after)))
          items.push({ selector, change: `${group.name}: ${from} → ${to}` })
          continue
        }
      }
      const to = p.after === '' ? '(reset)' : val(p.to, p.after)
      const extra = p.important ? ' !important' : ''
      items.push({ selector, change: `${p.prop}: ${val(p.from, p.before)} → ${to}${extra}` })
    } else if (p.kind === 'text') {
      const b = p.html ? stripTags(p.before) : p.before
      const a = p.html ? stripTags(p.after) : p.after
      const note = runtime ? ' (rendered by script — change it in the JS source)' : ''
      items.push({ selector, change: `text: "${truncate(b)}" → "${truncate(a)}"${note}` })
    } else if (p.kind === 'attr') {
      items.push({ selector, change: `attribute ${p.name}: ${JSON.stringify(p.before)} → ${JSON.stringify(p.after)}` })
    } else {
      items.push({ selector, change: 'removed' })
    }
  }
  return items
}

const safeComment = (s: string) => s.replace(/--/g, '- -')

function formatDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const RUNTIME_STYLE_ID = 'tweaker-edits'

/** CSS for edits on script-rendered elements, grouped by selector. */
export function buildRuntimeCss(patches: Patch[]): string {
  const rules = new Map<string, string[]>()
  for (const p of patches) {
    if (!isRuntimePatch(p) || p.kind !== 'style' || p.after === '') continue
    const decls = rules.get(p.selector) ?? []
    decls.push(`${p.prop}: ${p.after}${p.important ? ' !important' : ''};`)
    rules.set(p.selector, decls)
  }
  return Array.from(rules, ([sel, decls]) => `  ${sel} {\n${decls.map((d) => `    ${d}`).join('\n')}\n  }`).join('\n')
}

export function buildCommentBlock(items: ChangeItem[], date = new Date(), hasRuntimeCss = false): string {
  const width = Math.min(40, Math.max(0, ...items.map((i) => i.selector.length)) + 0)
  const lines = items.map((it, i) => `  ${`${i + 1}.`.padEnd(4)}${it.selector.padEnd(width)}  ${it.change}`)
  return [
    '<!--',
    '  ===== MANUAL DESIGN EDITS =====',
    `  Exported from HTML Tweaker on ${formatDate(date)}`,
    '  Edits were applied as inline styles. Please migrate them into the',
    '  proper classes / stylesheet (e.g. Tailwind utilities) and remove the',
    '  inline styles. Keep the resulting visual identical.',
    ...(hasRuntimeCss
      ? [
          `  Elements rendered by JavaScript were styled via <style id="${RUNTIME_STYLE_ID}">`,
          '  (structural selectors). Move those styles into the components that render them.',
        ]
      : []),
    '',
    ...(lines.length ? lines.map(safeComment) : ['  (no changes)']),
    '  ================================',
    '-->',
  ].join('\n')
}

export function buildPrompt(items: ChangeItem[]): string {
  return [
    'I manually tweaked the design of this page. Apply these changes to the code,',
    'using the proper classes/stylesheet (not inline styles), keeping the visual identical:',
    '',
    ...items.map((it, i) => `${i + 1}. ${it.selector} — ${it.change.replace(/^([a-z-]+): /, '$1 ')}`),
  ].join('\n')
}

/** original (prepared) HTML + patches → clean HTML with a comment block on top. Never reads the live DOM. */
export function exportHtml(preparedHtml: string, patches: Patch[], isFragment: boolean): string {
  const doc = new DOMParser().parseFromString(preparedHtml, 'text/html')
  for (const p of patches) if (!isRuntimePatch(p)) applyPatch(doc, p)

  doc.getElementById(OVERLAY_CSS_ID)?.remove()
  doc.querySelectorAll('[id^="__tw_"]').forEach((el) => el.remove())
  doc.querySelectorAll(`[${TW_ATTR}]`).forEach((el) => el.removeAttribute(TW_ATTR))

  const css = buildRuntimeCss(patches)
  if (css) {
    const style = doc.createElement('style')
    style.id = RUNTIME_STYLE_ID
    style.textContent = `\n  /* HTML Tweaker: edits on elements rendered by JavaScript */\n${css}\n`
    doc.head.appendChild(style)
  }
  const comment = buildCommentBlock(buildChangeList(preparedHtml, patches), new Date(), !!css)

  if (isFragment) {
    const head = Array.from(doc.head.children).map((el) => el.outerHTML).join('\n')
    return `${comment}\n${head ? `${head}\n` : ''}${doc.body.innerHTML}`
  }
  const html = serialize(doc)
  const nl = html.indexOf('\n')
  return `${html.slice(0, nl)}\n${comment}\n${html.slice(nl + 1)}`
}

export function editedFileName(name: string | null) {
  const base = (name ?? 'page.html').replace(/\.html?$/i, '')
  return `${base}.edited.html`
}

export function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
