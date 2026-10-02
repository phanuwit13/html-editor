export interface ParsedValue {
  num: number | null
  unit: string
  keyword: string | null
}

/** Parse "16px", "1.5rem", "50%", "auto", "normal". */
export function parseValue(input: string): ParsedValue {
  const s = input.trim()
  const m = s.match(/^(-?\d*\.?\d+)([a-z%]*)$/i)
  if (m) return { num: parseFloat(m[1]), unit: m[2].toLowerCase(), keyword: null }
  return { num: null, unit: '', keyword: s || null }
}

/** px number from computed values like "16px" (others → NaN). */
export function px(input: string): number {
  const v = parseFloat(input)
  return Number.isFinite(v) ? v : NaN
}

/** Round to at most 2 decimals and drop trailing zeros. */
export function round(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Turn what the user typed into a CSS value.
 * Bare numbers become px (or are unitless when `unitless` is set, e.g. opacity, font-weight).
 */
export function toCssValue(input: string, defaultUnit = 'px'): string | null {
  const s = input.trim()
  if (!s) return null
  const p = parseValue(s)
  if (p.num !== null) return `${round(p.num)}${p.unit || defaultUnit}`
  return s
}

export function formatPx(input: string): string {
  const n = px(input)
  return Number.isNaN(n) ? input : String(round(n))
}
