import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ClipboardCopy, Download, FileCode2, ListChecks, Monitor, MousePointer2, Play, Redo2, RotateCcw, Smartphone, Tablet, Undo2, X, Maximize } from 'lucide-react'
import { useEditorStore, type Viewport } from '../store/useEditorStore'
import { buildChangeList, buildPrompt } from '../editor/exporter'
import { exportCurrent } from '../editor/shortcuts'
import { cn } from '../lib/cn'

function IconButton({ title, onClick, disabled, active, children }: { title: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-35',
        active && 'bg-neutral-100 text-neutral-900',
      )}
    >
      {children}
    </button>
  )
}

const VIEWPORTS: { value: Viewport; label: string; icon: typeof Monitor }[] = [
  { value: 375, label: 'Mobile 375', icon: Smartphone },
  { value: 768, label: 'Tablet 768', icon: Tablet },
  { value: 1280, label: 'Desktop 1280', icon: Monitor },
  { value: 'full', label: 'Full width', icon: Maximize },
]

export default function Toolbar() {
  const fileName = useEditorStore((s) => s.fileName)
  const mode = useEditorStore((s) => s.mode)
  const patches = useEditorStore((s) => s.patches)
  const preparedHtml = useEditorStore((s) => s.preparedHtml)
  const canUndo = useEditorStore((s) => s.undoStack.length > 0)
  const canRedo = useEditorStore((s) => s.redoStack.length > 0)
  const viewport = useEditorStore((s) => s.viewportWidth)
  const { setMode, undo, redo, resetPreview, setViewport, closeFile, notify } = useEditorStore.getState()

  const [showChanges, setShowChanges] = useState(false)
  const [copied, setCopied] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => (preparedHtml && showChanges ? buildChangeList(preparedHtml, patches) : []), [preparedHtml, patches, showChanges])

  useEffect(() => {
    if (!showChanges) return
    const onDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setShowChanges(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [showChanges])

  const copyChanges = async () => {
    if (!preparedHtml) return
    const list = buildChangeList(preparedHtml, patches)
    if (!list.length) return notify('No changes yet')
    await navigator.clipboard.writeText(buildPrompt(list))
    setCopied(true)
    notify('Change list copied — paste it into your AI tool')
    setTimeout(() => setCopied(false), 1500)
  }

  const close = () => {
    if (patches.length && !confirm('Close this file? Unexported changes will be lost.')) return
    closeFile()
  }

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-sky-500 text-white">
          <FileCode2 className="size-4" />
        </div>
        <span className="truncate text-[12px] font-medium" title={fileName ?? ''}>
          {fileName}
        </span>
        <IconButton title="Close file" onClick={close}>
          <X className="size-3.5" />
        </IconButton>
      </div>

      <div className="flex items-center gap-1">
        <div className="flex rounded-lg bg-neutral-100 p-0.5" title="Toggle with E">
          {(['play', 'edit'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium capitalize text-neutral-500',
                mode === m && 'bg-white text-neutral-900 shadow-sm',
              )}
            >
              {m === 'play' ? <Play className="size-3.5" /> : <MousePointer2 className="size-3.5" />}
              {m}
            </button>
          ))}
        </div>
        <div className="mx-1 h-5 w-px bg-neutral-200" />
        {VIEWPORTS.map((v) => (
          <IconButton key={String(v.value)} title={v.label} active={viewport === v.value} onClick={() => setViewport(v.value)}>
            <v.icon className="size-4" />
          </IconButton>
        ))}
        <div className="mx-1 h-5 w-px bg-neutral-200" />
        <IconButton title="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 className="size-4" />
        </IconButton>
        <IconButton title="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 className="size-4" />
        </IconButton>
        <IconButton title="Reset preview (clears page state, keeps edits)" onClick={resetPreview}>
          <RotateCcw className="size-4" />
        </IconButton>
      </div>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        <div className="relative" ref={popRef}>
          <button
            onClick={() => setShowChanges((v) => !v)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-neutral-600 hover:bg-neutral-100"
          >
            <ListChecks className="size-4" /> Changes
            <span className={cn('rounded-full px-1.5 text-[10px] font-semibold leading-4', patches.length ? 'bg-sky-500 text-white' : 'bg-neutral-200 text-neutral-500')}>{patches.length}</span>
          </button>
          {showChanges && (
            <div className="absolute right-0 top-9 z-50 max-h-[60vh] w-[420px] overflow-auto rounded-lg border border-neutral-200 bg-white p-2 shadow-xl">
              {items.length === 0 ? (
                <p className="p-3 text-center text-neutral-500">No changes yet</p>
              ) : (
                <ol className="space-y-1">
                  {items.map((it, i) => (
                    <li key={i} className="rounded-md px-2 py-1.5 hover:bg-neutral-50">
                      <div className="font-mono text-[11px] text-sky-700">
                        {i + 1}. {it.selector}
                      </div>
                      <div className="font-mono text-[11px] text-neutral-700">{it.change}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
        <button
          onClick={copyChanges}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-neutral-200 px-2 text-[12px] font-medium hover:bg-neutral-50"
          title="Copy a ready-to-paste prompt for your AI tool"
        >
          {copied ? <Check className="size-3.5 text-green-600" /> : <ClipboardCopy className="size-3.5" />} Copy change list
        </button>
        <button
          onClick={exportCurrent}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-sky-500 px-2.5 text-[12px] font-medium text-white hover:bg-sky-600"
          title="Export (⌘E)"
        >
          <Download className="size-3.5" /> Export
        </button>
      </div>
    </header>
  )
}
