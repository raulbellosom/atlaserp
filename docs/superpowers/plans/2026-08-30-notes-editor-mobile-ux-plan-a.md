# Notes Editor Mobile UX — Plan A (Editor Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the notes editor a real scroll container, a trailing paragraph after every block, and a body placeholder, so a blank note is writable, the cover is reachable after scrolling, and the cursor can land below a trailing image.

**Architecture:** Frontend-only changes to `apps/desktop`. A new `TrailingNode` TipTap extension guarantees the document ends in an empty paragraph. `NoteEditor.jsx` wraps `EditorProvider` in an `overflow-y-auto` container and the toolbar becomes sticky. The `Placeholder` callback and two `.tiptap` CSS rules are updated. Pure helpers (`needsTrailingNode`, `bodyPlaceholderText`) are unit-tested with `node --test`; TipTap/DOM wiring is verified manually.

**Tech Stack:** React 18, `@tiptap/react` v3, `@tiptap/core`, `@tiptap/pm`, Tailwind, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-30-notes-editor-mobile-ux-design.md`

---

## File Structure

Create:
- `apps/desktop/src/modules/atlas.notes/lib/extensions/TrailingNode.js` — the extension + the pure `needsTrailingNode` helper.
- `apps/desktop/src/modules/atlas.notes/lib/placeholderText.js` — the pure `bodyPlaceholderText` helper (kept out of `editor-extensions.js` so it is importable by a test without pulling the whole TipTap bundle).
- `apps/desktop/src/modules/atlas.notes/lib/__tests__/trailing-node.test.js`
- `apps/desktop/src/modules/atlas.notes/lib/__tests__/placeholder-text.test.js`

Modify:
- `apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js` — register `TrailingNode`, use `bodyPlaceholderText`.
- `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx` — scroll container + empty-title autosave.
- `apps/desktop/src/styles.css` — body placeholder rule + `.tiptap img` sizing + sticky toolbar within scroll.

---

## Task 1: `needsTrailingNode` helper + failing test

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/extensions/TrailingNode.js`
- Test: `apps/desktop/src/modules/atlas.notes/lib/__tests__/trailing-node.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/modules/atlas.notes/lib/__tests__/trailing-node.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { needsTrailingNode } from '../extensions/TrailingNode.js'

test('needsTrailingNode: true when last node is not in notAfter', () => {
  assert.equal(needsTrailingNode('image', ['paragraph']), true)
})

test('needsTrailingNode: false when last node is a paragraph', () => {
  assert.equal(needsTrailingNode('paragraph', ['paragraph']), false)
})

test('needsTrailingNode: respects a multi-entry notAfter list', () => {
  assert.equal(needsTrailingNode('heading', ['paragraph', 'heading']), false)
  assert.equal(needsTrailingNode('codeBlock', ['paragraph', 'heading']), true)
})

test('needsTrailingNode: true when there is no last node', () => {
  assert.equal(needsTrailingNode(undefined, ['paragraph']), true)
  assert.equal(needsTrailingNode(null, ['paragraph']), true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/trailing-node.test.js`
Expected: FAIL — `Cannot find module '../extensions/TrailingNode.js'`.

- [ ] **Step 3: Write the extension + helper**

Create `apps/desktop/src/modules/atlas.notes/lib/extensions/TrailingNode.js`:

```js
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * Pure predicate: does the document need an empty trailing node appended?
 * @param {string|null|undefined} lastNodeTypeName - doc.lastChild?.type.name
 * @param {string[]} notAfter - node type names after which NO trailing node is needed
 */
export function needsTrailingNode(lastNodeTypeName, notAfter) {
  if (!lastNodeTypeName) return true
  return !notAfter.includes(lastNodeTypeName)
}

/**
 * Ensures the document always ends with an empty paragraph, so the caret can
 * land below a trailing atom (image, drawing) and a fresh note has a body
 * block for the placeholder to target.
 */
export const TrailingNode = Extension.create({
  name: 'trailingNode',

  addOptions() {
    return { node: 'paragraph', notAfter: ['paragraph'] }
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey(this.name)
    const notAfter = this.options.notAfter
    const nodeName = this.options.node
    const editor = this.editor

    return [
      new Plugin({
        key: pluginKey,
        appendTransaction: (_transactions, _oldState, newState) => {
          if (editor && editor.isEditable === false) return
          const { doc, tr, schema } = newState
          if (!needsTrailingNode(doc.lastChild?.type.name, notAfter)) return
          const type = schema.nodes[nodeName]
          if (!type) return
          return tr.insert(doc.content.size, type.create())
        },
      }),
    ]
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/trailing-node.test.js`
Expected: PASS — 4 tests.

- [ ] **Step 5: Syntax-check the extension**

Run: `node --check apps/desktop/src/modules/atlas.notes/lib/extensions/TrailingNode.js`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/extensions/TrailingNode.js apps/desktop/src/modules/atlas.notes/lib/__tests__/trailing-node.test.js
git commit -m "feat(notes): add TrailingNode extension to keep an empty paragraph at doc end"
```

---

## Task 2: `bodyPlaceholderText` helper + failing test

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/placeholderText.js`
- Test: `apps/desktop/src/modules/atlas.notes/lib/__tests__/placeholder-text.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/modules/atlas.notes/lib/__tests__/placeholder-text.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { bodyPlaceholderText } from '../placeholderText.js'

test('first node gets the title placeholder', () => {
  assert.equal(
    bodyPlaceholderText({ isFirst: true, nodeTypeName: 'paragraph', isEmpty: true, docChildCount: 1 }),
    'Sin título',
  )
})

test('heading gets the heading placeholder', () => {
  assert.equal(
    bodyPlaceholderText({ isFirst: false, nodeTypeName: 'heading', isEmpty: true, docChildCount: 5 }),
    'Título…',
  )
})

test('empty body paragraph in an otherwise-empty note gets the start hint', () => {
  assert.equal(
    bodyPlaceholderText({ isFirst: false, nodeTypeName: 'paragraph', isEmpty: true, docChildCount: 2 }),
    'Empieza a escribir, o pulsa «/» para comandos',
  )
})

test('empty body paragraph in a note with content gets no placeholder', () => {
  assert.equal(
    bodyPlaceholderText({ isFirst: false, nodeTypeName: 'paragraph', isEmpty: true, docChildCount: 6 }),
    '',
  )
})

test('non-empty paragraph gets no placeholder', () => {
  assert.equal(
    bodyPlaceholderText({ isFirst: false, nodeTypeName: 'paragraph', isEmpty: false, docChildCount: 2 }),
    '',
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/placeholder-text.test.js`
Expected: FAIL — `Cannot find module '../placeholderText.js'`.

- [ ] **Step 3: Write the helper**

Create `apps/desktop/src/modules/atlas.notes/lib/placeholderText.js`:

```js
/**
 * Placeholder text for a block in the notes editor.
 * @param {object} arg
 * @param {boolean} arg.isFirst        - is this the document's first child (the title line)
 * @param {string}  arg.nodeTypeName   - node.type.name
 * @param {boolean} arg.isEmpty        - node has no content
 * @param {number}  arg.docChildCount  - editor.state.doc.childCount
 * @returns {string} placeholder text ('' = no placeholder)
 */
export function bodyPlaceholderText({ isFirst, nodeTypeName, isEmpty, docChildCount }) {
  if (isFirst) return 'Sin título'
  if (nodeTypeName === 'heading') return 'Título…'
  if (nodeTypeName === 'paragraph' && isEmpty && docChildCount <= 2) {
    return 'Empieza a escribir, o pulsa «/» para comandos'
  }
  return ''
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/placeholder-text.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/placeholderText.js apps/desktop/src/modules/atlas.notes/lib/__tests__/placeholder-text.test.js
git commit -m "feat(notes): add bodyPlaceholderText helper for the editor placeholder"
```

---

## Task 3: Wire `TrailingNode` + placeholder into `buildExtensions`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js`

- [ ] **Step 1: Add the imports**

At the top of `editor-extensions.js`, after the existing `SlashCommand` import (line 14), add:

```js
import { TrailingNode } from './extensions/TrailingNode.js'
import { bodyPlaceholderText } from './placeholderText.js'
```

- [ ] **Step 2: Replace the `Placeholder.configure` block**

Replace the current `Placeholder.configure({ ... })` call (lines 38-47) with:

```js
    Placeholder.configure({
      showOnlyCurrent: false,
      placeholder: ({ editor, node }) =>
        bodyPlaceholderText({
          isFirst: editor.state.doc.firstChild === node,
          nodeTypeName: node.type.name,
          isEmpty: node.content.size === 0,
          docChildCount: editor.state.doc.childCount,
        }),
    }),
```

- [ ] **Step 3: Register `TrailingNode` in the `base` array**

In the `base` array, immediately after the `Placeholder.configure({...})` entry, add:

```js
    TrailingNode,
```

- [ ] **Step 4: Syntax-check**

Run: `node --check apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js`
Expected: no output (exit 0).

- [ ] **Step 5: Run the full notes lib test folder**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/`
Expected: PASS — all tests from Tasks 1 and 2.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js
git commit -m "feat(notes): register TrailingNode and body placeholder in the editor"
```

---

## Task 4: Empty-title autosave in `NoteEditor.jsx`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx:83-88`

Context: today `handleUpdate` only sets `patch.title` when the first line is
non-empty, so clearing the title leaves the stale `"Nueva nota"`. The API
(`notes-service.js` `updateNote`) writes `data.title ?? ''` when `title` is
present, so sending `''` is safe. The list renders `title || 'Sin titulo'`.

- [ ] **Step 1: Change the patch construction**

Replace these lines inside the `setTimeout` callback of `handleUpdate`:

```js
          const firstChild = editor.state.doc.firstChild
          const firstLineText = firstChild?.textContent?.trim() ?? ''
          const patch = { content }
          if (firstLineText) patch.title = firstLineText
```

with:

```js
          const firstChild = editor.state.doc.firstChild
          const firstLineText = firstChild?.textContent?.trim() ?? ''
          // Always send title (empty string clears it → list shows "Sin
          // titulo") instead of leaving the stale "Nueva nota".
          const patch = { content, title: firstLineText }
```

- [ ] **Step 2: Syntax-check**

Run: `node --check apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx`
Expected: no output. (If `node --check` chokes on JSX, run `npx --yes esbuild apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx --loader=jsx --bundle=false > /dev/null` instead; expected: no error.)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx
git commit -m "fix(notes): clear the note title when the first line is emptied"
```

---

## Task 5: Real scroll container + sticky toolbar in `NoteEditor.jsx`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx:195-251`

Context: the return currently is
`<div ref={containerRef} className="flex flex-col h-full overflow-hidden"><EditorProvider ...></EditorProvider></div>`
with nothing scrollable inside, so content taller than the pane (including the
cover, which lives in `slotBefore`) is clipped and unreachable.

- [ ] **Step 1: Wrap `EditorProvider` in a scroll container**

Change the outer return so `EditorProvider` sits inside a scrolling div:

```jsx
  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <EditorProvider
          extensions={extensions}
          content={note.content || ''}
          editable={!readOnly}
          onUpdate={handleUpdate}
          editorProps={{
            attributes: {
              class: 'focus:outline-none px-8 pt-1 pb-6 min-h-full',
            },
          }}
          slotBefore={
            <>
              <NoteCoverBanner
                coverUrl={note.cover_url}
                editable={!readOnly}
                noteId={note.id}
                token={token}
                onChange={coverUrl => updateNoteMeta({ coverUrl })}
                onRemove={() => updateNoteMeta({ coverUrl: null })}
              />
              {!readOnly && (
                <div className="sticky top-0 z-20">
                  <NoteToolbar noteId={note.id} token={token} />
                </div>
              )}
              {!readOnly && (
                <div className="px-8 pt-4 flex items-center justify-between gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
                        title="Seleccionar icono"
                      >
                        {note.icon
                          ? <NoteIcon name={note.icon} size={22} className="text-amber-500" />
                          : <NotebookPen className="w-5 h-5 text-muted-foreground/50" />
                        }
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-84 p-3" side="bottom" align="start">
                      <NoteIconPickerContent
                        value={note.icon}
                        onChange={icon => updateNoteMeta({ icon })}
                      />
                    </PopoverContent>
                  </Popover>
                  <PresenceStack users={presenceUsers} />
                </div>
              )}
            </>
          }
        >
          {/* EditorProvider renders children inside editor context */}
        </EditorProvider>
      </div>
    </div>
  )
```

Note: `NoteToolbar` already carries `sticky top-0 z-10` on its own root; the
extra wrapper `div` with `sticky top-0 z-20` is what actually pins it inside
the new scroll container (the toolbar's own `sticky` had no scrolling ancestor
before). Keep both — the wrapper does the pinning, the inner class keeps the
backdrop/shadow band full-width.

- [ ] **Step 2: Verify the diff touched only the return block**

Run: `git diff apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx`
Expected: only the `return (...)` JSX changed; imports, hooks, effects untouched.

- [ ] **Step 3: Syntax-check**

Run: `npx --yes esbuild apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx --loader=jsx --bundle=false > /dev/null`
Expected: no error.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx
git commit -m "fix(notes): make the editor body a real scroll container, pin the toolbar"
```

---

## Task 6: `.tiptap` CSS — body placeholder, image sizing

**Files:**
- Modify: `apps/desktop/src/styles.css` (placeholder block ~558-574; add an image rule near the `.tiptap` content rules)

- [ ] **Step 1: Add the body-placeholder rule**

In `styles.css`, directly after the existing block that ends at line 574
(`.tiptap > p:first-child.is-empty::before { ... opacity: 0.45; }`), add:

```css
/* Body "start writing" hint — normal text size, muted, only shown on the
   first empty paragraph of an otherwise-empty note (see bodyPlaceholderText) */
.tiptap p:not(:first-child).is-empty::before {
  font-size: 0.9375rem;
  font-weight: 400;
  opacity: 1;
  color: hsl(var(--muted-foreground));
}
```

- [ ] **Step 2: Add the image sizing rule**

Immediately after the rule from Step 1, add:

```css
/* Body images: never overflow the content column, keep aspect ratio.
   NOT !important — the crop wrapper (Plan B) overrides max-width on the <img>. */
.tiptap img {
  display: block;
  max-width: 100%;
  height: auto;
}
```

- [ ] **Step 3: Verify the CSS is syntactically balanced**

Run: `node -e "const c=require('fs').readFileSync('apps/desktop/src/styles.css','utf8');const o=(c.match(/{/g)||[]).length,x=(c.match(/}/g)||[]).length;if(o!==x){console.error('unbalanced braces',o,x);process.exit(1)}console.log('braces balanced',o)"`
Expected: `braces balanced <n>`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/styles.css
git commit -m "fix(notes): muted body placeholder + constrain body image size"
```

---

## Task 7: Build check + manual QA

**Files:** none (verification only)

- [ ] **Step 1: Lint the notes module**

Run: `pnpm --filter @atlas/desktop lint 2>&1 | tail -30`
Expected: no new errors in `apps/desktop/src/modules/atlas.notes/**` or
`apps/desktop/src/styles.css`. (If the desktop package name differs, use
`pnpm lint` from the repo root and inspect the notes-related output.)

- [ ] **Step 2: Start the dev frontend**

Run: `pnpm dev:frontend` (leave running in a second shell). Open
`http://localhost:5173`, log in, open atlas.notes.

- [ ] **Step 3: Manual checks — record pass/fail for each**

At 390px width and 1440px width, light and dark:

1. Create a new note. A muted line `Empieza a escribir, o pulsa «/» para comandos`
   is visible below the title line. Click it and type — body text is entered
   without needing to fill the title first.
2. Clear the title line entirely. The note list entry now reads `Sin titulo`
   (not `Nueva nota`).
3. In a note with several paragraphs, put the cursor at the end and press
   Enter a few times — only ever one empty trailing paragraph remains after
   you move the cursor up (TrailingNode is idempotent).
4. Insert an image (toolbar image button) as the last block. Click just below
   it — the caret lands in an empty paragraph; type and it works.
5. Add a cover (`Agregar portada`). Scroll down through a long note: the
   toolbar pins to the top once the cover scrolls past. Scroll back up: the
   cover is visible again.
6. Open a note in the public share view (`Compartir` → open the public link):
   content renders and the page scrolls normally; no console errors.

- [ ] **Step 4: Run the full notes test dir once more**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/`
Expected: PASS.

- [ ] **Step 5: Commit any QA-driven fixes, then tag the plan done**

```bash
git add -A
git commit -m "test(notes): Plan A manual QA pass for editor-core mobile fixes" --allow-empty
```

---

## Self-Review (author checklist — completed)

- **Spec coverage:** point 1 (placeholder) → Tasks 2, 3, 6; point 4
  (type below image / sizing) → Tasks 1, 3, 6; point 5 (cover reachable) →
  Task 5. Empty-title behaviour → Task 4. TrailingNode shared plumbing →
  Task 1. Scroll container → Task 5.
- **Placeholders:** none — every code step shows full code; every command has
  expected output.
- **Type consistency:** `needsTrailingNode(lastNodeTypeName, notAfter)` and
  `bodyPlaceholderText({ isFirst, nodeTypeName, isEmpty, docChildCount })`
  are used with the same signatures in Tasks 1–3.
- **Out of scope for Plan A (handled in Plan B):** annotation view/edit mode,
  Pointer Events, free-hand pen, `crop` attribute + modal.
