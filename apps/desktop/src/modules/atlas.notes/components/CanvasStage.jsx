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
function CanvasStage({
  initialData,
  viewModeEnabled = false,
  onExcalidrawAPI,
  onChange,
  onPointerUpdate,
  langCode = 'es-ES',
}) {
  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={onExcalidrawAPI}
        initialData={initialData}
        viewModeEnabled={viewModeEnabled}
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
        langCode={langCode}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </div>
  )
}

export default memo(CanvasStage)
