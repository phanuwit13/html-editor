const toHex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')

/** Parse a CSS color string (rgb/rgba/hex/transparent) into RGBA components. */
export function parseColor(input: string): { r: number; g: number; b: number; a: number } | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  if (s.startsWith('#')) {
    let h = s.slice(1)
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
    if ([0, 2, 4].some((i) => Number.isNaN(n(i)))) return null
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 }
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/)
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const [r, g, b] = parts.slice(0, 3).map(Number)
    let a = 1
    if (parts[3] !== undefined) a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : Number(parts[3])
    if ([r, g, b, a].some((v) => Number.isNaN(v))) return null
    return { r, g, b, a }
  }
  return null
}

/** rgb()/rgba() → #rrggbb or #rrggbbaa (when alpha < 1). Returns input unchanged if unparsable. */
export function toHex(input: string): string {
  const c = parseColor(input)
  if (!c) return input
  if (c.a === 0) return 'transparent'
  const base = `#${toHex2(c.r)}${toHex2(c.g)}${toHex2(c.b)}`
  return c.a < 1 ? base + toHex2(c.a * 255) : base
}

export function isColorValue(s: string) {
  return parseColor(s) !== null
}

/** Normalise user input like "fff" / "#FFF" into a CSS colour, or null if invalid. */
export function normalizeColorInput(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (s.toLowerCase() === 'transparent') return 'transparent'
  const withHash = s.startsWith('#') ? s : `#${s}`
  if (parseColor(withHash)) return withHash.toLowerCase()
  if (parseColor(s)) return s
  return null
}
