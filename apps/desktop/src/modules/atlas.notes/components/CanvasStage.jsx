import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

// Thin wrapper so CanvasEditor / PublicCanvasView never statically import the
// heavy Excalidraw bundle — they lazy-load THIS module, which is the only place
// that pulls it in.
export default function CanvasStage({
  initialElements,
  initialAppState,
  initialFiles,
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
        initialData={{
          elements: initialElements ?? [],
          appState: { ...(initialAppState ?? {}), collaborators: new Map() },
          files: initialFiles ?? {},
          scrollToContent: true,
        }}
        viewModeEnabled={viewModeEnabled}
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
        langCode={langCode}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </div>
  )
}
