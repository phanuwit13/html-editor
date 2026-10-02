# HTML Tweaker

Open an HTML file produced by an AI tool, click through it (Play mode), tweak colours / sizes / spacing / text like in Figma (Edit mode), and export the same file with a summary of what changed, so your AI tool can carry on from there.

- One file at a time, no projects.
- Runs entirely in the browser: no backend, no login, nothing uploaded.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/ (deploy anywhere, or open dist/index.html)
```

Sample files to try are in `fixtures/`.

## How it works

- **Original + patches.** The original HTML is kept as a string. Every edit is recorded as a patch. The canvas edits the live DOM only as a preview. Export re-parses the original, applies the patches, strips the editor markers, and adds a `MANUAL DESIGN EDITS` comment block. Whatever the page's scripts changed during Play mode never ends up in the export.
- **Element identity.** Before the page loads, every element in `<body>` gets `data-tw-id="tw-N"`. Elements the page's scripts create at runtime have no id. You can select them, but you can't edit them.
- **Edits are inline styles.** The comment block and "Copy change list" ask your AI tool to move them into proper classes (e.g. Tailwind).

## Security note

The preview iframe uses `sandbox="allow-scripts allow-same-origin …"`, so the editor can reach into the page directly. This also means **scripts in the file you open can access the editor page**. That's acceptable because you only open your own files, and the editor holds no data worth stealing. Don't open HTML files you don't trust.

## Shortcuts

| Key | Action |
|---|---|
| `E` | Toggle Play / Edit |
| `Esc` | Deselect / cancel text edit |
| `⌘/Ctrl+Z`, `⇧⌘/Ctrl+Z` | Undo / redo |
| `Delete` / `Backspace` | Delete selected element |
| `Enter` | Edit text of selected element |
| `⇧Enter` | Select parent |
| `⌘/Ctrl+E` | Export |
