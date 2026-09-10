import { memo } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

// Thin wrapper so CanvasEditor / PublicCanvasView never statically import the
// heavy Excalidraw bundle — they lazy-load THIS module, which is the only place
// that pulls it in.
//
// memo + a stable `initialData` prop (built once by the parent) are load-
// bearing: Excalidraw treats a change to its props as a signal and fires
// onChange, so a parent re-render with a fresh initialData object drives an
// infinite onChange -> setState -> re-render loop. Every prop here must be
// referentially stable for the life of the note.

// Excalidraw's own shape "Library" (book icon) is not part of the Atlas UX and
// renders with broken theming inside the embed. Hide it and the mobile menu
// entry for it. Scoped under .excalidraw so it can't leak.
const HIDE_LIBRARY_CSS = `
.excalidraw .library-button,
.excalidraw [data-testid="library-button"],
.excalidraw button[aria-label="Library"],
.excalidraw button[aria-label="Biblioteca"] { display: none !important; }
`

const CANVAS_ACTIONS = {
  loadScene: false,
  saveToActiveFile: false,
  saveAsImage: false,
  export: false,
  clearCanvas: false,
  changeViewBackgroundColor: true,
  toggleTheme: false,
}

function CanvasStage({
  initialData,
  viewModeEnabled = false,
  theme = 'light',
  onExcalidrawAPI,
  onChange,
  onPointerUpdate,
  langCode = 'es-ES',
}) {
  return (
    <div className="h-full w-full">
      <style>{HIDE_LIBRARY_CSS}</style>
      <Excalidraw
        excalidrawAPI={onExcalidrawAPI}
        initialData={initialData}
        viewModeEnabled={viewModeEnabled}
        theme={theme}
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
        langCode={langCode}
        UIOptions={{ canvasActions: CANVAS_ACTIONS }}
      />
    </div>
  )
}

export default memo(CanvasStage)
