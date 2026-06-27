# File Viewer — Mobile Responsive Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four cross-platform issues in `AdvancedFileViewer` and `ChatMessageBubble` so PDFs, video, audio, and the image toolbar work correctly on iOS, Android, and desktop.

**Architecture:** All changes are isolated to two UI component files. No new routes, no API changes, no new dependencies — `DropdownMenu` is already in `@atlas/ui`. Each task is a self-contained diff that can be committed independently.

**Tech Stack:** React, Tailwind CSS, Lucide icons, `@atlas/ui` (DropdownMenu), Radix Dialog (already used)

**Spec:** `docs/superpowers/specs/2026-06-26-file-viewer-mobile-responsive-design.md`

---

## File Map

| File | What changes |
|---|---|
| `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx` | Tasks 1, 2, 3 |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | Task 4 |

---

## Task 1: PDF — "Abrir PDF" button overlay

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`

- [ ] **Step 1.1: Wrap the PDF iframe in a relative group container and add the overlay button**

Replace the current PDF viewer block (lines ~448-455):

```jsx
{/* PDF viewer */}
{!loading && signedUrl && kind === "pdf" && (
  <iframe
    src={signedUrl}
    title={file?.originalName ?? "PDF"}
    className="h-full w-full"
    style={{ touchAction: "pan-y" }}
  />
)}
```

With:

```jsx
{/* PDF viewer */}
{!loading && signedUrl && kind === "pdf" && (
  <div className="relative h-full w-full group">
    <iframe
      src={signedUrl}
      title={file?.originalName ?? "PDF"}
      className="h-full w-full"
      style={{ touchAction: "pan-y" }}
    />
    {/* Mobile: always visible. Desktop: appears on hover */}
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 pointer-events-none md:pointer-events-auto">
      <button
        onClick={() => window.open(signedUrl, "_blank")}
        className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium glass shadow-lg text-[hsl(var(--foreground))]"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Abrir PDF
      </button>
    </div>
  </div>
)}
```

Note: `ExternalLink` is already imported at the top of the file — no new imports needed.

- [ ] **Step 1.2: Manual verify**

Open a PDF in the file viewer on desktop: the button should not appear until you hover over the content area. On a simulated mobile viewport (DevTools → iPhone SE or similar), the button should be permanently visible at the bottom center.

- [ ] **Step 1.3: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx
git commit -m "feat(viewer): add native PDF opener button overlay for mobile"
```

---

## Task 2: Video — `playsInline` for iOS inline playback

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`

- [ ] **Step 2.1: Add `playsInline` and `preload="metadata"` to the video element**

Locate the video player block (~lines 458-468):

```jsx
{/* Video player */}
{!loading && signedUrl && kind === "video" && (
  <div className="h-full w-full flex items-center justify-center bg-black">
    <video
      key={signedUrl}
      src={signedUrl}
      controls
      className="max-h-full max-w-full"
      style={{ outline: "none" }}
    />
  </div>
)}
```

Replace with:

```jsx
{/* Video player */}
{!loading && signedUrl && kind === "video" && (
  <div className="h-full w-full flex items-center justify-center bg-black">
    <video
      key={signedUrl}
      src={signedUrl}
      controls
      playsInline
      preload="metadata"
      className="max-h-full max-w-full"
      style={{ outline: "none" }}
    />
  </div>
)}
```

`playsInline` (camelCase) is the React prop — React renders it as the `playsinline` DOM attribute which covers iOS Safari 10+. `preload="metadata"` loads the first frame for a thumbnail.

- [ ] **Step 2.2: Manual verify**

Open a video file in the viewer. On desktop it should play inline as before. On iOS Safari (or Chrome iOS), tapping play must not trigger the fullscreen native player — the video plays inside the dialog.

- [ ] **Step 2.3: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx
git commit -m "feat(viewer): add playsInline to prevent iOS fullscreen video takeover"
```

---

## Task 3: Image toolbar — compact layout on mobile

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`

- [ ] **Step 3.1: Add new imports**

At the top of the file, add `MoreHorizontal` to the lucide imports:

```jsx
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  Minus,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";
```

Add `@atlas/ui` DropdownMenu imports after the existing imports:

```jsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@atlas/ui";
```

- [ ] **Step 3.2: Replace the bottom toolbar with the responsive version**

Replace the entire `{/* ── BOTTOM TOOLBAR (images only) ────────────── */}` block (~lines 559-635) with:

```jsx
{/* ── BOTTOM TOOLBAR (images only) ────────────── */}
{kind === "image" && !loading && signedUrl && (
  <div className="flex items-center justify-center gap-1.5 px-4 h-12 safe-bottom shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/60">
    {/* Zoom group — always visible */}
    <div className="flex items-center rounded-lg bg-[hsl(var(--muted))]/60 p-0.5">
      <ToolbarBtn
        onClick={() => nudgeZoom(-1)}
        title="Reducir zoom"
        disabled={zoom <= MIN_ZOOM}
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <button
        onClick={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        title="Restablecer zoom"
        className="h-7 min-w-13 px-2 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors duration-150 tabular-nums"
      >
        {Math.round(zoom * 100)}%
      </button>
      <ToolbarBtn
        onClick={() => nudgeZoom(1)}
        title="Aumentar zoom"
        disabled={zoom >= MAX_ZOOM}
      >
        <Plus className="h-3.5 w-3.5" />
      </ToolbarBtn>
    </div>

    {/* Desktop (≥ sm): full rotate + flip + reset groups */}
    <div className="hidden sm:flex items-center gap-1.5">
      <div className="w-px h-4 bg-[hsl(var(--border))] mx-0.5" />
      <div className="flex items-center rounded-lg bg-[hsl(var(--muted))]/60 p-0.5">
        <ToolbarBtn
          onClick={() => setRotation((v) => v - 90)}
          title="Rotar izquierda"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => setRotation((v) => v + 90)}
          title="Rotar derecha"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>
      <div className="w-px h-4 bg-[hsl(var(--border))] mx-0.5" />
      <div className="flex items-center rounded-lg bg-[hsl(var(--muted))]/60 p-0.5">
        <ToolbarBtn
          onClick={() => setFlipX((v) => !v)}
          title="Voltear horizontal"
          active={flipX}
        >
          <FlipHorizontal2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => setFlipY((v) => !v)}
          title="Voltear vertical"
          active={flipY}
        >
          <FlipVertical2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>
      <div className="w-px h-4 bg-[hsl(var(--border))] mx-0.5" />
      <ToolbarBtn onClick={resetTransforms} title="Restablecer todo">
        <RefreshCw className="h-3.5 w-3.5" />
      </ToolbarBtn>
    </div>

    {/* Mobile (< sm): collapse rotate/flip/reset into DropdownMenu */}
    <div className="sm:hidden flex items-center">
      <div className="w-px h-4 bg-[hsl(var(--border))] mx-1.5" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title="Mas opciones"
            className="h-8 w-8 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-all duration-150"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end">
          <DropdownMenuItem onSelect={() => setRotation((v) => v - 90)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Rotar izquierda
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRotation((v) => v + 90)}>
            <RotateCw className="h-4 w-4 mr-2" />
            Rotar derecha
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setFlipX((v) => !v)}>
            <FlipHorizontal2 className="h-4 w-4 mr-2" />
            {flipX ? "Quitar volteo horizontal" : "Voltear horizontal"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFlipY((v) => !v)}>
            <FlipVertical2 className="h-4 w-4 mr-2" />
            {flipY ? "Quitar volteo vertical" : "Voltear vertical"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={resetTransforms}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Restablecer todo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
)}
```

- [ ] **Step 3.3: Manual verify**

Open an image in the viewer. On a simulated ≤ 640px viewport (DevTools), the toolbar should show only `[−] [75%] [+]` and a `⋯` button. Tapping `⋯` opens the dropdown with rotate/flip/reset items. On a ≥ 640px viewport, the full toolbar appears as before.

- [ ] **Step 3.4: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx
git commit -m "feat(viewer): collapse image toolbar rotate/flip into dropdown on mobile"
```

---

## Task 4: AudioCard width fix in ChatMessageBubble

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

- [ ] **Step 4.1: Fix the AudioCard container width**

Locate the `AudioCard` component (~lines 114-139) and change `max-w-55` to `w-full max-w-xs`:

```jsx
function AudioCard({ att, isOwn }) {
  const { data: url, isLoading } = useAttachmentUrl(att);

  return (
    <div className="mt-1.5 w-full max-w-xs">
      {isLoading ? (
        <div className="flex items-center gap-2 opacity-50">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Cargando audio...</span>
        </div>
      ) : url ? (
        <audio
          src={url}
          controls
          className="w-full"
          style={{ height: 36, filter: isOwn ? "invert(1) brightness(0.85)" : "none" }}
        />
      ) : (
        <div className="flex items-center gap-2 text-xs opacity-50">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{att.fileName}</span>
        </div>
      )}
    </div>
  );
}
```

`max-w-xs` = 320px, which comfortably fits the iOS native audio controls (minimum ~280px).

- [ ] **Step 4.2: Manual verify**

Open a chat with an audio attachment. On a simulated 375px viewport, the audio player should not be cramped — all controls (play, scrubber, time, volume) should be visible and tappable.

- [ ] **Step 4.3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "fix(chat): widen AudioCard from max-w-55 to max-w-xs for iOS controls"
```

---

## Self-Review Notes

- Spec section 1 (PDF overlay) → Task 1 ✓
- Spec section 2 (video playsInline) → Task 2 ✓
- Spec section 3 (image toolbar compact) → Task 3 ✓
- Spec section 4 (audio width) → Task 4 ✓
- No placeholder text, no TBDs
- `ExternalLink` import verified already present in file
- `DropdownMenu` exports verified in `@atlas/ui/src/index.js`
- `MoreHorizontal` added to lucide import list in Task 3 step 1
