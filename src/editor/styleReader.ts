import { toHex } from '../lib/color'
import { formatPx } from '../lib/units'
import type { Side } from './patches'

export const SIDES: Side[] = ['top', 'right', 'bottom', 'left']
export const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const

export interface InspectorModel {
  tag: string
  classes: string[]
  display: string
  hasElementChildren: boolean
  text: string
  typography: {
    fontSize: string
    fontWeight: string
    lineHeight: string
    letterSpacing: string
    textAlign: string
    color: string
    fontFamily: string
  }
  fill: { backgroundColor: string }
  padding: Record<Side, string>
  margin: Record<Side, string>
  size: { width: string; height: string; inlineWidth: string; inlineHeight: string }
  border: {
    radius: Record<(typeof CORNERS)[number], string>
    width: string
    style: string
    color: string
  }
  effects: { opacity: string; boxShadow: string }
}

/** Read the *computed* style of an element into numbers/hex the Inspector can show. */
export function readStyle(el: HTMLElement): InspectorModel {
  const win = el.ownerDocument.defaultView!
  const cs = win.getComputedStyle(el)
  const g = (p: string) => cs.getPropertyValue(p)
  const sides = (prefix: string, suffix = '') =>
    Object.fromEntries(SIDES.map((s) => [s, formatPx(g(`${prefix}-${s}${suffix}`))])) as Record<Side, string>
  const rect = el.getBoundingClientRect()

  return {
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList),
    display: g('display'),
    hasElementChildren: el.children.length > 0,
    text: el.textContent ?? '',
    typography: {
      fontSize: formatPx(g('font-size')),
      fontWeight: g('font-weight'),
      lineHeight: g('line-height') === 'normal' ? 'normal' : formatPx(g('line-height')),
      letterSpacing: g('letter-spacing') === 'normal' ? '0' : formatPx(g('letter-spacing')),
      textAlign: normalizeAlign(g('text-align')),
      color: toHex(g('color')),
      fontFamily: g('font-family').split(',')[0].replace(/["']/g, '').trim(),
    },
    fill: { backgroundColor: toHex(g('background-color')) },
    padding: sides('padding'),
    margin: sides('margin'),
    size: {
      // computed width/height respect box-sizing, so writing the number back keeps the size identical
      width: formatPx(g('width').endsWith('px') ? g('width') : String(rect.width)),
      height: formatPx(g('height').endsWith('px') ? g('height') : String(rect.height)),
      inlineWidth: el.style.width,
      inlineHeight: el.style.height,
    },
    border: {
      radius: Object.fromEntries(CORNERS.map((c) => [c, formatPx(g(`border-${c}-radius`))])) as InspectorModel['border']['radius'],
      width: formatPx(g('border-top-width')),
      style: g('border-top-style'),
      color: toHex(g('border-top-color')),
    },
    effects: { opacity: g('opacity'), boxShadow: g('box-shadow') },
  }
}

function normalizeAlign(v: string) {
  if (v === 'start' || v === '-webkit-left') return 'left'
  if (v === 'end' || v === '-webkit-right') return 'right'
  if (v === '-webkit-center') return 'center'
  return v
}

/** Human-readable computed value for the change list (colors → hex). */
export function displayValue(el: HTMLElement, prop: string): string {
  const v = el.ownerDocument.defaultView!.getComputedStyle(el).getPropertyValue(prop).trim()
  if (/color/.test(prop)) return toHex(v)
  if (prop === 'box-shadow') return v
  return v
}
