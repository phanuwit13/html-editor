import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { canEditText, canvas } from '../../../editor/canvasController'
import type { InspectorModel } from '../../../editor/styleReader'
import { useEditorStore } from '../../../store/useEditorStore'
import Section from '../controls/Section'

interface Props {
  el: HTMLElement
  model: InspectorModel
}

const DEBOUNCE_MS = 400

export default function TextSection({ el, model }: Props) {
  const { ok, html } = canEditText(el)
  if (!ok) return null
  return (
    <Section title="Text">
      {html ? <HtmlText el={el} text={model.text} /> : <PlainText el={el} text={model.text} />}
    </Section>
  )
}

function HtmlText({ el, text }: { el: HTMLElement; text: string }) {
  return (
    <>
      <p className="line-clamp-4 whitespace-pre-wrap break-words rounded bg-neutral-100 px-2 py-1.5 text-[12px] text-neutral-700">
        {text.trim() || <span className="text-neutral-400">Empty</span>}
      </p>
      <p className="text-[11px] text-neutral-400">Contains inline formatting — edit it on the canvas.</p>
      <button
        type="button"
        className="flex h-7 items-center justify-center gap-1.5 rounded bg-neutral-100 text-[11px] text-neutral-700 hover:bg-neutral-200"
        onClick={() => canvas.startTextEdit(el)}
      >
        <Pencil className="size-3.5" />
        Edit inline
      </button>
    </>
  )
}

function PlainText({ el, text }: { el: HTMLElement; text: string }) {
  const [draft, setDraft] = useState(text)
  const focused = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<string | null>(null)

  // Follow external changes (undo, inline edit) — but never while the user is typing here.
  useEffect(() => {
    if (!focused.current) setDraft(text)
  }, [el, text])

  const flush = () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    const after = pending.current
    pending.current = null
    if (after === null) return
    const before = el.textContent ?? ''
    // read from the element itself: on unmount the store may already point at the next selection
    useEditorStore.getState().setText(el, before, after, false, false, 'text')
  }
  const flushRef = useRef(flush)
  useLayoutEffect(() => {
    flushRef.current = flush
  })

  // Commit whatever is pending when the element changes / section unmounts.
  useEffect(() => () => flushRef.current(), [el])

  return (
    <textarea
      className="min-h-16 w-full resize-y rounded bg-neutral-100 px-2 py-1.5 text-[12px] text-neutral-800 outline-none hover:ring-1 hover:ring-neutral-300 focus:ring-1 focus:ring-sky-500"
      rows={3}
      value={draft}
      spellCheck={false}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false
        flush()
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        pending.current = e.target.value
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => flushRef.current(), DEBOUNCE_MS)
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') e.currentTarget.blur()
      }}
    />
  )
}
