import { useRef, useState } from 'react'
import { ClipboardPaste, FileCode2, Upload } from 'lucide-react'
import { useEditorStore } from '../store/useEditorStore'
import { cn } from '../lib/cn'

export default function DropZone() {
  const loadFile = useEditorStore((s) => s.loadFile)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [paste, setPaste] = useState('')
  const [error, setError] = useState<string | null>(null)

  const readFile = async (file: File | undefined) => {
    if (!file) return
    if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
      setError(`"${file.name}" is not an .html file`)
      return
    }
    loadFile(file.name, await file.text())
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
            <FileCode2 className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">HTML Tweaker</h1>
          <p className="mt-1 text-[13px] text-neutral-500">Open an HTML file from your AI tool, tweak the design like Figma, export it back.</p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            readFile(e.dataTransfer.files[0])
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-white px-6 py-12 text-center transition-colors',
            dragging ? 'border-sky-500 bg-sky-50' : 'border-neutral-300 hover:border-neutral-400',
          )}
        >
          <Upload className="size-6 text-neutral-400" />
          <div className="text-[14px] font-medium">Drop a .html file here</div>
          <div className="text-[12px] text-neutral-500">or click to choose a file</div>
          <input ref={inputRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
        </div>
        {error && <p className="mt-2 text-center text-[12px] text-red-600">{error}</p>}

        <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-neutral-400">
          <div className="h-px flex-1 bg-neutral-300" /> or paste code <div className="h-px flex-1 bg-neutral-300" />
        </div>

        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="<!DOCTYPE html>…"
          spellCheck={false}
          className="h-32 w-full resize-none rounded-lg border border-neutral-300 bg-white p-3 font-mono text-[12px] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
        />
        <button
          disabled={!paste.trim()}
          onClick={() => loadFile('pasted.html', paste)}
          className="mt-2 inline-flex h-8 w-full items-center justify-center gap-2 rounded-md bg-neutral-900 text-[12px] font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ClipboardPaste className="size-4" /> Open pasted HTML
        </button>

        <p className="mt-6 text-center text-[11px] text-neutral-400">Everything runs in your browser. Nothing is uploaded or saved.</p>
      </div>
    </div>
  )
}
