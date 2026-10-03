# plan.md — HTML Tweaker (ชื่อชั่วคราว)

> เครื่องมือเว็บสำหรับ UX/UI designer: โหลด HTML ไฟล์ที่ AI สร้างมา → กดเล่น flow ได้ → จิ้ม element แล้วแก้สี/ขนาด/ระยะห่าง/ข้อความเองแบบ Figma → export เป็น HTML ไฟล์เดิมพร้อมสรุปการแก้ เพื่อเอากลับไปให้ AI ของตัวเองทำต่อ

---

## 1. Goal และ Non‑goals

**Goal**
- แก้ HTML **ทีละไฟล์** ไม่มีแนวคิดเรื่องโปรเจกต์
- ทำงานใน browser ล้วน ๆ ไม่มี backend, ไม่มี login, ไม่เก็บข้อมูลผู้ใช้
- ไฟล์ที่ export ออกมาต้อง "อ่านรู้เรื่อง" สำหรับ AI ปลายทาง (มี comment สรุปว่าแก้อะไรไปบ้าง)

**Non‑goals (ตัดทิ้งชัดเจน ห้ามหลุดเข้ามาใน MVP)**
- หลายไฟล์ / zip / navigation ข้ามหน้า
- AI assist ในตัว
- บันทึกโปรเจกต์, version history, แชร์ลิงก์, collaboration
- แปลง inline style กลับเป็น Tailwind class (ให้ AI ปลายทางทำ)
- แก้ layout แบบลากย้ายตำแหน่ง (drag to reposition) — อาจทำใน phase หลัง

---

## 2. User flow

1. เปิดเว็บ → เห็น DropZone "ลาก .html มาวาง หรือ paste code"
2. ไฟล์ render ใน Canvas (iframe) เริ่มที่ **Play mode** ทันที กดปุ่ม/ลิงก์ในหน้าได้เหมือนเปิดจริง
3. กด `E` หรือปุ่ม toggle → **Edit mode**
   - hover เห็นกรอบน้ำเงิน + ป้ายชื่อ element (`button.cta-btn`)
   - click = select → Inspector ด้านขวาแสดงค่าปัจจุบัน
   - double‑click ข้อความ = แก้ text ตรงที่
4. ปรับค่าใน Inspector → เห็นผลทันทีบน Canvas
5. กด `Cmd/Ctrl+Z` undo ได้
6. กด **Export** → ดาวน์โหลด `<ชื่อไฟล์เดิม>.edited.html` หรือกด **Copy change list** เพื่อเอาไป paste เป็น prompt
7. ปิดแท็บได้เลย ไม่มีอะไรค้าง

---

## 3. Tech stack

| ส่วน | เลือกใช้ | เหตุผล |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | เร็ว เบา AI coding tool คุ้นเคย |
| UI ของ editor | Tailwind CSS + shadcn/ui | ได้หน้าตาเรียบร้อยเร็ว |
| State | Zustand | state น้อย ไม่ต้องใช้ของหนัก |
| Color picker | `react-colorful` | เล็ก ไม่มี dependency |
| Icons | `lucide-react` | |
| Deploy | Static (Vercel / GitHub Pages / เปิดไฟล์ในเครื่อง) | ไม่มี server |

ไม่ใช้: backend, database, auth, router, i18n library

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Editor shell (React)                                         │
│ ┌──────────┐ ┌──────────────────────────┐ ┌────────────────┐ │
│ │ Toolbar  │ │ Canvas                   │ │ Inspector      │ │
│ │ Play/Edit│ │ <iframe srcdoc=...>      │ │ (right panel)  │ │
│ │ Undo/Redo│ │   + overlay (ใน iframe)  │ │                │ │
│ │ Export   │ │                          │ │                │ │
│ └──────────┘ └──────────────────────────┘ └────────────────┘ │
│                                                              │
│ editor/ : prepareHtml · canvasController · patches · exporter│
└──────────────────────────────────────────────────────────────┘
```

### 4.1 หลักการสำคัญ: "Original + Patches" ไม่ใช่ "Live DOM"

- เก็บ **HTML ต้นฉบับ** (string) ไว้เสมอ
- ทุกการแก้ถูกบันทึกเป็น **Patch** ลง list
- Canvas แก้ live DOM เพื่อให้เห็นผลทันที (preview เท่านั้น)
- ตอน **Export** ไม่ serialize live DOM แต่: parse ต้นฉบับใหม่ด้วย `DOMParser` → apply patches ทั้งหมด → ลบ marker → serialize

เหตุผล: ใน Play mode script ของหน้าอาจเปลี่ยน DOM (เปิด modal, toggle class, เพิ่ม element) ถ้า export จาก live DOM จะได้ state ที่เพี้ยน การ export จาก ต้นฉบับ+patches ทำให้ผลลัพธ์เสถียรและ undo/redo ง่าย

### 4.2 Element identity

- ก่อนโหลดเข้า iframe: parse HTML ด้วย `DOMParser` → เดิน DOM ทุก element ใน `<body>` ใส่ `data-tw-id="tw-1"`, `tw-2`, … ตามลำดับ → serialize กลับเป็น string → ใส่ `iframe.srcdoc`
- ทำแบบนี้เพื่อให้ id อยู่ใน source ก่อน script ของหน้าจะรัน → id เสถียร และ export reproduce ได้
- Element ที่ script สร้างขึ้นตอน runtime จะไม่มี id → เลือกได้แต่แก้ไม่ได้ แสดงข้อความ "element นี้ถูกสร้างด้วย script แก้จากที่นี่ไม่ได้"
- ตอน export ลบ `data-tw-id` ทั้งหมดออก

### 4.3 iframe

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
  srcdoc="...">
```
- `allow-same-origin` ทำให้ parent เข้าถึง `iframe.contentDocument` ได้ตรง ๆ → **ไม่ต้องทำ postMessage bridge** (ลดงานมหาศาล)
- trade‑off: script ในไฟล์ของผู้ใช้เข้าถึง editor ได้ด้วย ยอมรับได้เพราะเป็นไฟล์ของผู้ใช้เอง และไม่มีข้อมูลอะไรให้ขโมย แสดงหมายเหตุใน README
- Reload iframe ใหม่เมื่อ: โหลดไฟล์ใหม่ หรือกด "Reset preview" (เพื่อล้าง state ของ Play mode) — หลัง reload ให้ re‑apply patches ทั้งหมดลง live DOM

---

## 5. Data model

```ts
type Side = 'top' | 'right' | 'bottom' | 'left';

type Patch =
  | { id: string; twId: string; kind: 'style'; prop: string; before: string; after: string }
  | { id: string; twId: string; kind: 'text';  before: string; after: string }
  | { id: string; twId: string; kind: 'attr';  name: string; before: string | null; after: string | null }
  | { id: string; twId: string; kind: 'remove'; outerHTML: string; parentTwId: string; index: number };

interface EditorState {
  fileName: string | null;
  originalHtml: string | null;     // ต้นฉบับ (ยังไม่ใส่ id)
  preparedHtml: string | null;     // ต้นฉบับ + data-tw-id
  mode: 'play' | 'edit';
  selectedTwId: string | null;
  hoveredTwId: string | null;
  patches: Patch[];                // ลำดับการแก้ทั้งหมด (สำหรับ export)
  undoStack: Patch[];
  redoStack: Patch[];
  viewportWidth: number | 'full';  // 375 / 768 / 1280 / full
}
```

กติกา:
- การแก้ prop เดิมซ้ำบน element เดิม ให้ **รวม** เป็น patch เดียว (เก็บ `before` อันแรก, `after` ล่าสุด) เพื่อให้ change list อ่านง่าย
- undo = apply inverse ของ patch ล่าสุด แล้วย้ายไป redoStack

---

## 6. Modules (`src/editor/`)

| ไฟล์ | หน้าที่ |
|---|---|
| `prepareHtml.ts` | parse → ใส่ `data-tw-id` → inject `<style id="__tw_overlay_css">` + overlay elements → serialize |
| `canvasController.ts` | attach/detach listener สำหรับ Edit mode, วาด overlay, จัดการ hover/select, double‑click text edit |
| `styleReader.ts` | `getComputedStyle(el)` → `InspectorModel` (แปลง `rgb()`→hex, แยก padding 4 ด้าน ฯลฯ) |
| `patches.ts` | types, `applyPatch(doc, patch)`, `invertPatch(patch)`, `mergePatch(list, patch)` |
| `selector.ts` | สร้าง selector อ่านง่ายสำหรับ change list เช่น `section.hero > h1`, `button.cta-btn`, `#pricing .card:nth-child(2)` |
| `exporter.ts` | parse `preparedHtml` → apply patches → ลบ id/overlay → prepend comment → serialize → download |
| `shortcuts.ts` | keyboard shortcuts |

### 6.1 Edit mode behaviour (`canvasController`)

- เมื่อเข้า Edit mode: เพิ่ม listener แบบ **capture** บน `iframe.contentDocument`
  - `pointerdown`, `click`, `mousedown`, `mouseup`, `submit`: `preventDefault()` + `stopPropagation()` → script ของหน้าไม่ทำงาน
  - `mousemove`: `elementFromPoint` → set hovered
  - `click`: set selected
  - `dblclick` บน element ที่มี text node ตรง ๆ: เปิด `contentEditable` → บน `blur`/`Enter` บันทึก text patch
  - `keydown`: ส่งต่อให้ `shortcuts.ts` (Delete, ลูกศร, Esc)
- เมื่อออกจาก Edit mode: ถอด listener ทั้งหมด ซ่อน overlay
- `scroll` และ `ResizeObserver` → redraw overlay ทุกครั้ง

### 6.2 Overlay (วาดอยู่ *ใน* iframe)

- `<div id="__tw_hover">` กรอบน้ำเงิน 1px + label ชื่อ selector
- `<div id="__tw_select">` กรอบน้ำเงิน 2px + handle มุม (phase 2 ใช้ resize)
- `<div id="__tw_margin">` / `<div id="__tw_padding">` สีส้ม/เขียวโปร่งแบบ DevTools เฉพาะ element ที่ select
- ทุกตัว `pointer-events: none; position: absolute; z-index: 2147483647`
- ใช้ `getBoundingClientRect()` + `scrollX/scrollY` ของ iframe ในการวาง

---

## 7. Inspector spec

ค่าปัจจุบันอ่านจาก `getComputedStyle` เสมอ (ไม่ใช่จาก inline style) แล้วเขียนทับด้วย `el.style.setProperty(prop, value)`

| Section | Controls | CSS prop |
|---|---|---|
| **Element** | ชื่อ tag + class (read‑only), ปุ่ม Hide / Delete | `display:none` / remove patch |
| **Text** | textarea (sync กับ dblclick inline edit) | textContent |
| **Typography** | font‑size, font‑weight (dropdown 400/500/600/700), line‑height, letter‑spacing, text‑align, color | ตามชื่อ |
| **Fill** | background‑color (color picker + hex input + "transparent") | `background-color` |
| **Spacing** | Padding 4 ด้าน, Margin 4 ด้าน — มีปุ่ม link ให้แก้พร้อมกันทุกด้าน | `padding-*`, `margin-*` |
| **Size** | width, height — input + dropdown หน่วย `px / % / auto` | `width`, `height` |
| **Border** | radius (รวม/แยกมุม), width, color | `border-*` |
| **Effects** | opacity (slider), shadow (preset: none / sm / md / lg) | `opacity`, `box-shadow` |

Number input behaviour (สำคัญ ให้เหมือน Figma):
- ลากซ้าย‑ขวาบน label เพื่อ scrub ค่า
- ลูกศรขึ้น/ลง ±1, กด Shift ±10
- พิมพ์ `16` → ตีความเป็น `16px` ถ้าไม่ใส่หน่วย

---

## 8. Export spec

### 8.1 ไฟล์ `.edited.html`
1. `DOMParser.parseFromString(preparedHtml)` (script ไม่รัน)
2. วนตาม `patches` → `applyPatch` ลง doc นี้
3. ลบ `data-tw-id` ทุกตัว, ลบ `#__tw_*` overlay และ `<style id="__tw_overlay_css">`
4. สร้าง comment block แล้วแทรกไว้ **บรรทัดแรกหลัง `<!DOCTYPE html>`** (ถ้าไม่มี doctype ให้ไว้บนสุด)
5. serialize: `'<!DOCTYPE html>\n' + doc.documentElement.outerHTML`
6. ดาวน์โหลดด้วย Blob + `<a download>`

### 8.2 รูปแบบ comment block

```html
<!--
  ===== MANUAL DESIGN EDITS =====
  Exported from HTML Tweaker on 2026-10-02 14:32
  Edits were applied as inline styles. Please migrate them into the
  proper classes / stylesheet (e.g. Tailwind utilities) and remove the
  inline styles. Keep the resulting visual identical.

  1. section.hero > h1             font-size: 32px → 40px
  2. button.cta-btn                background-color: #3b82f6 → #16a34a
  3. button.cta-btn                padding: 12px 20px → 16px 28px
  4. section.hero > p              text: "Get started today" → "เริ่มใช้งานฟรีวันนี้"
  5. footer .social-links          removed
  ================================
-->
```

### 8.3 "Copy change list"
copy ข้อความแบบ prompt พร้อมใช้:

```
I manually tweaked the design of this page. Apply these changes to the code,
using the proper classes/stylesheet (not inline styles), keeping the visual identical:

1. section.hero > h1 — font-size 32px → 40px
2. button.cta-btn — background-color #3b82f6 → #16a34a
...
```

---

## 9. Keyboard shortcuts

| Key | Action |
|---|---|
| `E` | toggle Play / Edit |
| `Esc` | ยกเลิก selection / ออกจาก text edit |
| `Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z` | undo / redo |
| `Delete` / `Backspace` | ลบ element ที่เลือก |
| `Cmd/Ctrl+D` | duplicate (phase 2) |
| `Enter` | เริ่มแก้ text ของ element ที่เลือก |
| `Cmd/Ctrl+E` | export |

---

## 10. Project structure

```
src/
  main.tsx
  App.tsx
  components/
    DropZone.tsx
    Toolbar.tsx
    Canvas.tsx
    Inspector/
      Inspector.tsx
      sections/ (Typography.tsx, Fill.tsx, Spacing.tsx, Size.tsx, Border.tsx, Effects.tsx)
      controls/ (NumberInput.tsx, ColorInput.tsx, FourSides.tsx)
    LayersPanel.tsx          (phase 2)
  editor/
    prepareHtml.ts
    canvasController.ts
    styleReader.ts
    patches.ts
    selector.ts
    exporter.ts
    shortcuts.ts
  store/
    useEditorStore.ts
  lib/
    color.ts                 (rgb ↔ hex)
    units.ts                 (parse "16px", "1.5rem", "auto")
```

---

## 11. Implementation phases

### Phase 1 — MVP (เป้า: ใช้งานจริงได้ภายใน 1 สัปดาห์)

**Day 1–2: โครง + Canvas**
- [x] Vite + React + TS + Tailwind + shadcn/ui setup
- [x] `DropZone`: drag‑drop `.html`, file picker, paste textarea
- [x] `prepareHtml.ts`: ใส่ `data-tw-id`, inject overlay
- [x] `Canvas`: iframe srcdoc, Play mode ทำงานได้ (script ของหน้ารันปกติ)
- [x] Toolbar: toggle Play/Edit, ชื่อไฟล์, ปุ่ม Reset preview

**Day 3–4: Edit mode + Inspector**
- [x] `canvasController`: capture listeners, hover/select, overlay วาดถูกตำแหน่ง (ทดสอบกับหน้าที่ scroll ได้และมี `position: fixed`)
- [x] `styleReader`: อ่านค่าออกมาเป็น hex / px ถูกต้อง
- [x] Inspector: Typography, Fill, Spacing, Size, Border, Effects, Hide/Delete
- [x] `patches.ts`: apply + merge
- [x] Double‑click แก้ text

**Day 5: Export + Undo**
- [x] `exporter.ts`: original + patches → ไฟล์สะอาด + comment block
- [x] Copy change list
- [x] Undo/redo + shortcuts พื้นฐาน (`E`, `Esc`, `Cmd+Z`, `Delete`)
- [x] ทดสอบ: export → เปิดไฟล์ที่ได้ใน browser → หน้าตาตรงกับใน editor, ไม่มี `data-tw-id` หลงเหลือ

### Phase 2 — ให้รู้สึกเหมือน Figma (สัปดาห์ที่ 2)
- [x] Number input แบบ scrub + ลูกศร ±1/±10
- [x] Layers panel (DOM tree ย่อ/ขยาย, click เพื่อ select, sync กับ canvas)
- [x] Viewport presets 375 / 768 / 1280 / full
- [x] Resize handles ที่มุมของ selection → width/height
- [x] Duplicate element
- [x] เลือก parent ด้วย `Shift+Enter` / breadcrumb ใต้ Canvas
- [x] จำไฟล์ล่าสุดใน `sessionStorage` กัน refresh แล้วหาย (ไม่ใช่การเก็บโปรเจกต์)

### Phase 3 — ถ้ายังอยากต่อ (ไม่สัญญา)
- [ ] ลากย้ายตำแหน่ง element ภายใน parent เดียวกัน (reorder)
- [ ] Tailwind‑aware: ถ้าตรวจพบ Tailwind CDN ให้เสนอ class ที่ใกล้เคียงใน change list (เช่น `padding 24px ≈ p-6`)
- [ ] เปรียบเทียบ before/after แบบ side‑by‑side ก่อน export

---

## 12. Edge cases ที่ต้องรองรับใน Phase 1

| กรณี | วิธีจัดการ |
|---|---|
| หน้าใช้ Tailwind CDN / Google Fonts | iframe โหลดจาก network ได้ตามปกติ ไม่ต้องทำอะไร |
| ค่าเป็น `rem`/`em` | แสดงเป็น px ที่คำนวณแล้ว (จาก computed) และเขียนทับเป็น px |
| `color: rgb(...)` | แปลงเป็น hex ใน `lib/color.ts`; ถ้ามี alpha ให้แสดง hex 8 หลัก |
| Element ที่มี `!important` ใน stylesheet | inline style แพ้ → ให้ `setProperty(prop, value, 'important')` เมื่อ detect ว่าค่าไม่เปลี่ยน |
| Element สร้างโดย script (ไม่มี `data-tw-id`) | select ได้ แสดง notice แก้ไม่ได้ |
| `<a href>` ใน Edit mode | ถูก preventDefault อยู่แล้ว |
| ไฟล์ไม่มี `<body>` / HTML fragment | ห่อด้วย `<!DOCTYPE html><html><body>…</body></html>` ก่อน prepare และจำไว้ว่าต้องถอดออกตอน export |
| ไฟล์ใหญ่ (หลายพัน element) | การใส่ id เป็น O(n) ไม่มีปัญหา; overlay redraw ใช้ `requestAnimationFrame` throttle |
| ผู้ใช้ปิดแท็บโดยไม่ export | `beforeunload` เตือนถ้ามี patches ค้าง |

---

## 13. Acceptance criteria (Phase 1 ถือว่าเสร็จเมื่อ)

1. โหลด HTML ที่ได้จาก AI builder อย่างน้อย 3 แหล่งต่างกัน (เช่น ไฟล์ Tailwind CDN, ไฟล์ CSS ล้วน, ไฟล์ที่มี JS modal) แล้ว Play mode ใช้งานได้ครบ
2. ใน Edit mode คลิกเลือก element ใด ๆ แล้ว Inspector แสดงค่าตรงกับที่เห็นจริง
3. เปลี่ยนสี / font‑size / padding / text แล้วเห็นผลทันทีโดยไม่กระพริบ
4. Undo 10 ครั้งติดกันแล้ว redo กลับได้ครบ
5. Export แล้วเปิดไฟล์ใน browser: หน้าตาเหมือนใน editor 100%, ไม่มี `data-tw-id`, ไม่มี overlay, comment block อยู่บนสุดและรายการตรงกับที่แก้
6. เอาไฟล์ที่ export + change list ไปให้ Claude/ChatGPT อ่าน แล้ว AI เข้าใจและย้ายค่าเข้า class ได้โดยไม่ต้องอธิบายเพิ่ม

---

## 14. วิธีใช้ plan นี้กับ AI coding tool

ป้อน prompt ลักษณะนี้ทีละ phase:

```
อ่าน plan.md ทั้งไฟล์ แล้ว implement Phase 1 Day 1–2 ตาม checklist
ยึดโครงสร้างไฟล์ใน section 10 และ data model ใน section 5 อย่างเคร่งครัด
อย่าเพิ่ม feature ที่อยู่ใน Non-goals เสร็จแล้วให้ติ๊ก checkbox ใน plan.md
```

ทำทีละ block แล้วทดสอบด้วยไฟล์ HTML จริงก่อนไป block ถัดไป จุดที่มักพังและควรเช็กเป็นพิเศษ: overlay วางตำแหน่งผิดเมื่อ scroll, Edit mode ยังปล่อยให้ script ของหน้าทำงาน, export จาก live DOM แทนที่จะเป็น original + patches
