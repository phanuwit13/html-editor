const LANDMARKS = new Set(['header', 'nav', 'main', 'section', 'article', 'aside', 'footer', 'form', 'dialog'])

/** Utility classes (Tailwind etc.) make unreadable selectors — prefer "semantic" looking classes. */
const isReadableClass = (c: string) => !/[:/[\]().!@#%]/.test(c) && c.length < 32

/** Tailwind / utility-CSS class names — they say nothing about *which* element it is. */
const UTILITY =
  /^-?(?:[pm][trblxyse]?-|[wh]-|size-|min-|max-|text-|bg-|font-|leading-|tracking-|rounded|shadow|border|ring|outline|flex|grid|gap-|space-|items-|justify-|content-|self-|place-|col-|row-|order-|z-|top-|left-|right-|bottom-|inset|opacity-|transition|duration-|ease-|delay-|animate-|translate-|scale-|rotate-|skew-|origin-|cursor-|select-|overflow-|object-|aspect-|divide-|from-|via-|to-|fill-|stroke-|whitespace-|break-|list-|align-|decoration-|backdrop-|blur|drop-shadow|grow|shrink|basis-|float-|clear-|line-clamp-|pointer-events-|sr-only|not-sr-only|container$|block$|inline|hidden$|relative$|absolute$|fixed$|sticky$|static$|uppercase$|lowercase$|capitalize$|italic$|underline$|truncate$|antialiased$|table|isolate$|visible$|invisible$|tabular-nums$|prose)/

function describe(el: Element): string {
  const tag = el.tagName.toLowerCase()
  if (el.id && !el.id.startsWith('__tw')) return `#${CSS.escape(el.id)}`
  const classes = Array.from(el.classList).filter((c) => isReadableClass(c) && !UTILITY.test(c))
  return tag + classes.slice(0, 2).map((c) => `.${CSS.escape(c)}`).join('')
}

function withNth(el: Element, part: string): string {
  const parent = el.parentElement
  if (!parent || part.startsWith('#')) return part
  const same = Array.from(parent.children).filter((c) => c.tagName === el.tagName)
  if (same.length <= 1) return part
  const matching = same.filter((c) => describe(c) === part)
  if (matching.length <= 1) return part
  return `${part}:nth-of-type(${same.indexOf(el) + 1})`
}

/** Readable selector for the change list, e.g. `section.hero > h1`, `#pricing .card:nth-of-type(2)`. */
export function readableSelector(el: Element): string {
  const tag = el.tagName.toLowerCase()
  if (tag === 'body' || tag === 'html') return tag
  const parts: string[] = []
  let cur: Element | null = el
  let depth = 0
  while (cur && cur.tagName !== 'BODY' && cur.tagName !== 'HTML' && depth < 4) {
    const part = withNth(cur, describe(cur))
    parts.unshift(part)
    if (part.startsWith('#')) break
    const t = cur.tagName.toLowerCase()
    if (depth > 0 && LANDMARKS.has(t) && part !== t) break
    cur = cur.parentElement
    depth++
  }
  // Skip unhelpful middle links: keep first + last two when long
  if (parts.length > 3) return `${parts[0]} ${parts.slice(-2).join(' > ')}`
  return parts.join(' > ')
}

/** Short label for the overlay / breadcrumb: `button.cta-btn` */
export function shortLabel(el: Element): string {
  const tag = el.tagName.toLowerCase()
  if (el.id && !el.id.startsWith('__tw')) return `${tag}#${el.id}`
  const c = Array.from(el.classList).filter((c) => isReadableClass(c) && !UTILITY.test(c))[0] ?? Array.from(el.classList).filter(isReadableClass)[0]
  return c ? `${tag}.${c}` : tag
}

/** Classes that flip with UI state — never anchor a rule on them. */
const STATE_CLASS = /^(is-|has-)|(^|[-_])(active|open|opened|selected|current|checked|show|shown|hidden|visible|disabled|focus|hover|expanded|collapsed|loading)$/

const isUnique = (doc: Document, sel: string, el: Element) => {
  try {
    const found = doc.querySelectorAll(sel)
    return found.length === 1 && found[0] === el
  } catch {
    return false
  }
}

/**
 * Shortest unique selector for an element the page's script rendered (no data-tw-id),
 * e.g. `.ahero__info > h1.t-hero`. Built from stable component classes (no utility/state classes),
 * adding `:nth-child()` only where siblings are ambiguous; stops as soon as it is unique.
 */
export function runtimeSelector(el: Element): string {
  const doc = el.ownerDocument
  const parts: string[] = []
  let cur: Element | null = el
  while (cur && cur !== doc.documentElement) {
    const tag = cur.tagName.toLowerCase()
    if (cur.id && !cur.id.startsWith('__tw') && doc.querySelectorAll(`#${CSS.escape(cur.id)}`).length === 1) {
      parts.unshift(`#${CSS.escape(cur.id)}`)
      break
    }
    if (tag === 'body') {
      parts.unshift('body')
      break
    }
    const classes = Array.from(cur.classList).filter((c) => isReadableClass(c) && !UTILITY.test(c) && !STATE_CLASS.test(c))
    let part = tag + classes.slice(0, 2).map((c) => `.${CSS.escape(c)}`).join('')
    const parent: Element | null = cur.parentElement
    if (parent && Array.from(parent.children).filter((c) => c !== cur && c.matches(part)).length > 0) {
      part += `:nth-child(${Array.from(parent.children).indexOf(cur) + 1})`
    }
    parts.unshift(part)
    if (isUnique(doc, parts.join(' > '), el)) return parts.join(' > ')
    cur = parent
  }
  return parts.join(' > ')
}
