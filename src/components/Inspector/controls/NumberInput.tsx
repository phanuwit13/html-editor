import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { parseValue, round, toCssValue } from '../../../lib/units'

interface Props {
  label: ReactNode
  value: string
  onCommit: (css: string, coalesce: boolean) => void
  min?: number
  max?: number
  step?: number
  /** unit appended to bare numbers ('' → unitless) */
  unit?: string
  placeholder?: string
  title?: string
  /** value to start scrubbing/arrowing from when `value` isn't numeric (e.g. line-height "normal") */
  scrubBase?: number
  className?: string
}

/** Figma-style number field: scrub on the label, arrows ±1 (Shift ±10), Enter/blur commits. */
export default function NumberInput({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  unit = 'px',
  placeholder,
  title,
  scrubBase,
  className,
}: Props) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrub = useRef<{ x: number; start: number; last: number; unit: string; moved: boolean } | null>(null)

  const clamp = (n: number) => {
    if (min !== undefined) n = Math.max(min, n)
    if (max !== undefined) n = Math.min(max, n)
    return round(n)
  }
  const numericStart = (s: string) => {
    const p = parseValue(s)
    return { num: p.num ?? scrubBase ?? 0, unit: p.num !== null ? p.unit || unit : unit }
  }

  const commitDraft = () => {
    const css = toCssValue(draft, unit)
    if (css !== null && draft.trim() !== value) onCommit(css, false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitDraft()
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setDraft(value)
      // blur after the draft reset so the stale draft isn't committed
      requestAnimationFrame(() => inputRef.current?.blur())
      e.stopPropagation()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const { num, unit: u } = numericStart(draft)
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1) * step
      const next = clamp(num + delta)
      setDraft(String(next) + (u && u !== unit ? u : ''))
      onCommit(`${next}${u}`, true)
    }
    e.stopPropagation()
  }

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const { num, unit: u } = numericStart(value)
    scrub.current = { x: e.clientX, start: num, last: num, unit: u, moved: false }
  }
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = scrub.current
    if (!s) return
    const steps = Math.trunc((e.clientX - s.x) / 2)
    const next = clamp(s.start + steps * (e.shiftKey ? 10 : 1) * step)
    if (next === s.last) return
    s.last = next
    s.moved = true
    onCommit(`${next}${s.unit}`, true)
  }
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const s = scrub.current
    scrub.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (s && !s.moved) inputRef.current?.focus()
  }

  return (
    <div
      title={title}
      className={cn(
        'group flex h-7 min-w-0 items-center rounded bg-neutral-100 text-[11px] text-neutral-800 hover:ring-1 hover:ring-neutral-300',
        focused && 'ring-1 ring-sky-500 hover:ring-sky-500',
        className,
      )}
    >
      <span
        className="flex h-full w-6 shrink-0 cursor-ew-resize select-none items-center justify-center text-neutral-400 [&_svg]:size-3"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {label}
      </span>
      <input
        ref={inputRef}
        className="h-full w-full min-w-0 bg-transparent pr-1.5 outline-none placeholder:text-neutral-400"
        value={focused ? draft : value}
        placeholder={placeholder}
        spellCheck={false}
        onFocus={(e) => {
          setDraft(value)
          setFocused(true)
          e.currentTarget.select()
        }}
        onBlur={() => {
          commitDraft()
          setFocused(false)
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}
