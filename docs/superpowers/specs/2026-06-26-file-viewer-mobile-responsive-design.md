# File Viewer — Mobile Responsive Fixes

**Date:** 2026-06-26
**Status:** Approved
**Scope:** `AdvancedFileViewer` + `ChatMessageBubble` audio card

## Problem

The `AdvancedFileViewer` component (used both in `atlas.files` and via `ChatAttachmentViewer` in `atlas.chat`) has four cross-platform issues:

1. **PDF on iOS Safari**: `<iframe>` renders the PDF but touch manipulation (pinch-to-zoom, scroll between pages) is blocked by the dialog's `overflow: hidden` wrapper. There is no escape hatch to the OS native PDF viewer.
2. **Video on iOS**: `<video controls>` without `playsinline` forces fullscreen native player on iOS instead of playing inline within the dialog.
3. **Image toolbar overflow on mobile**: The bottom toolbar (zoom + rotate + flip groups) overflows or crowds on small screens (< 375px width).
4. **Audio card width**: `max-w-55` (220px) is too narrow for the native audio controls on iOS, causing them to look cramped.

## Out of Scope

- PDF.js integration (deferred)
- New file types
- Any change to the chat realtime layer or attachment upload flow

---

## Design

### 1 — PDF: "Abrir en visor nativo" button overlay

Keep the `<iframe>` for all platforms (works fine on Android Chrome and desktop).

Add an absolutely-positioned button `"Abrir PDF"` overlaid on the iframe:

- **Mobile (< `md`)**: always visible, positioned `bottom-4 left-1/2 -translate-x-1/2`
- **Desktop (≥ `md`)**: hidden by default, revealed on parent `group-hover`
- Style: `glass` pill with `ExternalLink` icon — same glass treatment as the navigation arrows
- Action: `window.open(signedUrl, "_blank")` — iOS Safari opens signed URL as its native PDF viewer

No new dependencies required.

```
┌──────────────────────────────────────┐
│  [iframe PDF — full area]            │
│                                      │
│       ┌───────────────────────┐      │
│       │  ↗  Abrir PDF         │      │  ← always visible on mobile
│       └───────────────────────┘      │  ← group-hover on desktop
└──────────────────────────────────────┘
```

### 2 — Video: `playsinline` attribute

Add `playsinline` (React prop) and `webkit-playsinline="true"` (DOM attribute via `ref` or `data-` passthrough) to the `<video>` element in `AdvancedFileViewer`.

Also add `preload="metadata"` so the first frame thumbnail appears immediately.

No layout changes needed — the `bg-black` container already works on all platforms.

### 3 — Image toolbar: mobile-compact layout

The bottom toolbar currently renders all controls unconditionally. On `< sm` screens:

- **Keep inline**: zoom group (`[−] [75%] [+]`)
- **Collapse to `DropdownMenu`**: rotate-left, rotate-right, flip-horizontal, flip-vertical, and reset — all in one `MoreHorizontal` trigger button
- The divider pipes between groups are hidden on mobile

On `≥ sm` screens: current layout unchanged.

`DropdownMenu` is already available from `@atlas/ui` — no new installs.

```
Mobile (< sm):  [−] [75%] [+]  |  [⋯]  ← DropdownMenu with rotate/flip/reset
Desktop (≥ sm): [−] [75%] [+]  | [↺][↻] | [⇔][⇕] | [↺]
```

### 4 — Audio card width in `ChatMessageBubble`

`AudioCard` uses `max-w-55` (220px). Change to `w-full max-w-xs` so the native audio controls have adequate horizontal space on iOS.

The `isOwn` filter inversion is kept as-is.

---

## Affected Files

| File | Change |
|---|---|
| `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx` | PDF button overlay, video attributes, image toolbar mobile collapse |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | AudioCard width fix |

`ChatAttachmentViewer.jsx` — no changes needed (it delegates to `AdvancedFileViewer`).

---

## Acceptance Criteria

- [ ] On iOS Safari, tapping "Abrir PDF" opens the PDF in a new tab where the native viewer works with pinch/scroll
- [ ] On desktop, the PDF iframe renders normally; the button only appears on hover
- [ ] Video plays inline within the dialog on iOS (no forced fullscreen takeover)
- [ ] On a 375px-wide viewport, the image toolbar fits in one row without overflow
- [ ] Rotate/flip controls are accessible via the `⋯` dropdown on mobile
- [ ] Audio controls in chat bubbles are at least 280px wide on iOS
- [ ] All four file types (image, pdf, video, audio) render and function on Android Chrome, iOS Safari, and desktop browsers
