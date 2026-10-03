import { ChevronRight } from 'lucide-react'
import { canvas } from '../editor/canvasController'
import { shortLabel } from '../editor/selector'
import { useEditorStore } from '../store/useEditorStore'
import { cn } from '../lib/cn'

/** Ancestors of the selection under the canvas — click to select a parent (also ⇧Enter). */
export default function Breadcrumb() {
  const el = useEditorStore((s) => s.selectedEl)
  useEditorStore((s) => s.revision)
  if (!el?.isConnected) return null
  const chain: HTMLElement[] = []
  for (let p: HTMLElement | null = el; p && p.tagName !== 'HTML'; p = p.parentElement) chain.unshift(p)
  const { select, setHovered } = useEditorStore.getState()
  return (
    <nav className="flex min-w-0 items-center overflow-hidden font-mono text-[11px]">
      {chain.map((node, i) => (
        <span key={i} className="flex shrink-0 items-center last:shrink">
          {i > 0 && <ChevronRight className="size-3 text-neutral-300" />}
          <button
            className={cn('truncate rounded px-1 hover:bg-neutral-100 hover:text-neutral-900', node === el && 'text-sky-700')}
            onClick={() => {
              select(node)
              canvas.reveal(node)
            }}
            onMouseEnter={() => setHovered(node, true)}
            onMouseLeave={() => setHovered(null, true)}
          >
            {shortLabel(node)}
          </button>
        </span>
      ))}
    </nav>
  )
}
