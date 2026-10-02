import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { HexAlphaColorPicker } from 'react-colorful'
import { cn } from '../../../lib/cn'
import { normalizeColorInput, toHex } from '../../../lib/color'

interface Props {
  value: string
  onCommit: (css: string, coalesce: boolean) => void
  allowTransparent?: boolean
  className?: string
}

const CHECKER: CSSProperties = {
  backgroundImage: 'conic-gradient(#d4d4d4 25%, #fff 0 50%, #d4d4d4 0 75%, #fff 0)',
  backgroundSize: '8px 8px',
}

export default function ColorInput({ value, onCommit, allowTransparent, className }: Props) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(value)
  const rootRef = useRef<HTMLDivElement>(null)
  const pickerHex = value === 'transparent' ? '#00000000' : value.startsWith('#') ? value : toHex(value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const commitDraft = () => {
    const css = normalizeColorInput(draft)
    if (css && css !== value) onCommit(css, false)
  }

  return (
    <div ref={rootRef} className={cn('relative flex min-w-0 items-center gap-1', className)}>
      <div
        className={cn(
          'flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded bg-neutral-100 pl-1 text-[11px] hover:ring-1 hover:ring-neutral-300',
          focused && 'ring-1 ring-sky-500 hover:ring-sky-500',
        )}
      >
        <button
          type="button"
          aria-label="Pick colour"
          className="relative size-5 shrink-0 overflow-hidden rounded-sm ring-1 ring-black/10"
          style={CHECKER}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="absolute inset-0" style={{ background: value }} />
        </button>
        <input
          className="h-full w-full min-w-0 bg-transparent pr-1.5 font-mono text-[11px] uppercase text-neutral-800 outline-none"
          value={focused ? draft : value}
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
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setDraft(value)
              const t = e.currentTarget
              requestAnimationFrame(() => t.blur())
            }
          }}
        />
      </div>
      {allowTransparent && (
        <button
          type="button"
          title="Transparent"
          className={cn(
            'h-7 shrink-0 rounded px-1.5 text-[11px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800',
            value === 'transparent' && 'bg-neutral-100 text-neutral-800',
          )}
          onClick={() => value !== 'transparent' && onCommit('transparent', false)}
        >
          None
        </button>
      )}
      {open && (
        <div className="absolute left-0 top-8 z-50 rounded-lg bg-white p-2 shadow-lg ring-1 ring-black/10 [&_.react-colorful]:h-44 [&_.react-colorful]:w-52">
          <HexAlphaColorPicker color={pickerHex} onChange={(hex) => onCommit(hex, true)} />
        </div>
      )}
    </div>
  )
}
