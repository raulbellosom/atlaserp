import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Layers, FileDown } from 'lucide-react'
import { useAuth } from '../../../auth/AuthProvider'
import { supabase } from '../../../lib/supabase'
import { useCanvasScene, useSaveCanvasScene } from '../hooks/useCanvasScene.js'
import {
  ensureLayers,
  defaultLayer,
  assignLayer,
  deriveScene,
  mergeDown,
  duplicateLayer,
} from '../lib/canvasLayers.js'
import { SupabaseCanvasSync } from '../lib/SupabaseCanvasSync.js'
import { syncNewImages, hydrateImages } from '../lib/canvasImages.js'
import { exportCanvasPng, exportCanvasSvg } from '../lib/canvasExport.js'
import { CanvasLayersPanel } from './CanvasLayersPanel.jsx'

const CanvasStage = lazy(() => import('./CanvasStage.jsx'))
const AUTOSAVE_DELAY = 1500
const PRESENCE_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#06b6d4', '#f97316']

function colorForUser(seed) {
  const s = String(seed ?? '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length]
}

// Top-first list from the panel -> normalised ascending `order`
// (index 0 in the panel is the frontmost layer = highest order).
function orderFromTopFirst(topFirst) {
  const n = topFirst.length
  return topFirst.map((l, i) => ({ ...l, order: n - 1 - i }))
}

export function CanvasEditor({ note }) {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const noteId = note?.id

  const { data, isLoading, error } = useCanvasScene(noteId)
  const saveScene = useSaveCanvasScene(noteId)

  const elementsRef = useRef([]) // full element list = source of truth
  const [layers, setLayers] = useState([defaultLayer()])
  const layersRef = useRef(layers)
  layersRef.current = layers
  const [activeLayerId, setActiveLayerId] = useState(null)
  const filesManifestRef = useRef({})
  const appStateRef = useRef({})
  const [ready, setReady] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [countsTick, setCountsTick] = useState(0)

  const apiRef = useRef(null)
  const syncRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const on = () => setIsMobile(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Seed from the server scene once loaded.
  useEffect(() => {
    if (!data?.scene) return
    let cancelled = false
    ;(async () => {
      const s = data.scene
      elementsRef.current = Array.isArray(s.elements) ? s.elements : []
      const ls = ensureLayers(s.layers)
      setLayers(ls)
      const topLayer = [...ls].sort((a, b) => b.order - a.order)[0]
      setActiveLayerId(topLayer.id)
      filesManifestRef.current = s.files ?? {}
      appStateRef.current = s.appState ?? {}
      const files = await hydrateImages(s.files)
      if (cancelled) return
      if (apiRef.current && files.length) apiRef.current.addFiles(files)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [data?.scene])

  // Realtime provider — lifecycle keyed by note + token (see NoteEditor's engine).
  useEffect(() => {
    if (!noteId || !token) return undefined
    const sync = new SupabaseCanvasSync({
      noteId,
      supabase,
      identity: {
        id: session?.user?.id,
        name: userProfile?.displayName ?? session?.user?.email ?? 'Usuario',
        color: colorForUser(session?.user?.id ?? session?.user?.email),
        avatarUrl: userProfile?.avatarUrl ?? null,
      },
      getLocalElements: () => elementsRef.current,
      getSnapshot: () => ({
        elements: elementsRef.current,
        layers: layersRef.current,
        appState: appStateRef.current,
        files: filesManifestRef.current,
      }),
      onRemoteElements: (reconciled) => {
        elementsRef.current = reconciled
        apiRef.current?.updateScene({ elements: deriveScene(reconciled, layersRef.current) })
        setCountsTick((t) => t + 1)
      },
      onRemoteSnapshot: (snap) => {
        elementsRef.current = Array.isArray(snap.elements) ? snap.elements : elementsRef.current
        if (Array.isArray(snap.layers) && snap.layers.length) setLayers(ensureLayers(snap.layers))
        if (snap.appState) appStateRef.current = snap.appState
        apiRef.current?.updateScene({
          elements: deriveScene(elementsRef.current, snap.layers ?? layersRef.current),
        })
        setCountsTick((t) => t + 1)
      },
      onRemotePointer: (p) => {
        const map = new Map()
        map.set(p.senderId, {
          pointer: { x: p.x, y: p.y },
          username: p.user?.name,
          color: p.user?.color,
        })
        apiRef.current?.updateScene({ collaborators: map })
      },
    })
    syncRef.current = sync
    return () => {
      sync.destroy()
      syncRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, token])

  const persist = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveScene.mutate({
        elements: elementsRef.current,
        appState: appStateRef.current,
        layers: layersRef.current,
        files: filesManifestRef.current,
      })
    }, AUTOSAVE_DELAY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Flush once on unmount so a fast note switch never drops the last edits.
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current)
      if (elementsRef.current.length || Object.keys(filesManifestRef.current).length) {
        saveScene.mutate({
          elements: elementsRef.current,
          appState: appStateRef.current,
          layers: layersRef.current,
          files: filesManifestRef.current,
        })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const handleChange = useCallback(
    async (elements, appState) => {
      const active = activeLayerId ?? layersRef.current[0]?.id
      const withLayers = elements.map((el) => assignLayer(el, active))
      elementsRef.current = withLayers
      appStateRef.current = {
        gridModeEnabled: appState?.gridModeEnabled,
        gridSize: appState?.gridSize,
        objectsSnapModeEnabled: appState?.objectsSnapModeEnabled,
        viewBackgroundColor: appState?.viewBackgroundColor,
      }
      syncRef.current?.notifyLocalChange()
      persist()
      setCountsTick((t) => t + 1)

      // Upload any freshly added images.
      const files = apiRef.current?.getFiles?.() ?? {}
      const hasNew = Object.keys(files).some((id) => !filesManifestRef.current[id]?.url)
      if (hasNew) {
        try {
          filesManifestRef.current = await syncNewImages({
            files,
            manifest: filesManifestRef.current,
            noteId,
            token,
          })
          persist()
        } catch (err) {
          console.warn('[canvas] image upload failed:', err?.message)
        }
      }
    },
    [activeLayerId, noteId, token, persist],
  )

  const handlePointer = useCallback((payload) => {
    const p = payload?.pointer
    if (!p) return
    syncRef.current?.broadcastPointer({ x: p.x, y: p.y })
  }, [])

  // Re-derive whenever layers change (visibility / lock / opacity / order).
  useEffect(() => {
    if (ready) apiRef.current?.updateScene({ elements: deriveScene(elementsRef.current, layers) })
  }, [layers, ready])

  const elementCounts = useMemo(() => {
    const c = {}
    for (const el of elementsRef.current) {
      if (el.isDeleted) continue
      const id = el.customData?.layerId
      if (id) c[id] = (c[id] ?? 0) + 1
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, countsTick])

  const mutateLayers = useCallback(
    (next) => {
      setLayers(next)
      persist()
    },
    [persist],
  )

  const layerCbs = {
    activeLayerId,
    elementCounts,
    onSelect: setActiveLayerId,
    onRename: (id, name) => mutateLayers(layers.map((l) => (l.id === id ? { ...l, name } : l))),
    onToggleVisible: (id) =>
      mutateLayers(layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))),
    onToggleLocked: (id) =>
      mutateLayers(layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))),
    onOpacity: (id, opacity) =>
      mutateLayers(layers.map((l) => (l.id === id ? { ...l, opacity } : l))),
    onReorderList: (topFirst) => mutateLayers(orderFromTopFirst(topFirst)),
    onDuplicate: (id) => {
      const { layers: nl, elements: ne } = duplicateLayer(layers, elementsRef.current, id)
      elementsRef.current = ne
      mutateLayers(nl)
      setCountsTick((t) => t + 1)
    },
    onMergeDown: (id) => {
      const { layers: nl, elements: ne } = mergeDown(layers, elementsRef.current, id)
      elementsRef.current = ne
      mutateLayers(nl)
      setCountsTick((t) => t + 1)
    },
    onDelete: (id) => {
      if (layers.length === 1) return
      elementsRef.current = elementsRef.current.filter((el) => el.customData?.layerId !== id)
      const nl = [...layers]
        .filter((l) => l.id !== id)
        .sort((a, b) => a.order - b.order)
        .map((l, i) => ({ ...l, order: i }))
      if (activeLayerId === id) setActiveLayerId(nl[nl.length - 1].id)
      mutateLayers(nl)
      setCountsTick((t) => t + 1)
    },
  }

  const addLayer = () => {
    const order = layers.length
    const nl = [...layers, defaultLayer(`Capa ${order + 1}`, order)]
    setActiveLayerId(nl[nl.length - 1].id)
    mutateLayers(nl)
  }

  const doExport = (fn) =>
    fn({
      elements: deriveScene(elementsRef.current, layers),
      appState: appStateRef.current,
      files: apiRef.current?.getFiles?.() ?? {},
      title: note?.title,
    })

  if (error) {
    return <div className="p-8 text-sm text-muted-foreground">No se pudo cargar el lienzo.</div>
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-1 px-3 h-11 border-b border-border shrink-0">
          <button
            type="button"
            onClick={() => doExport(exportCanvasPng)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg"
            title="Exportar PNG"
          >
            <FileDown size={13} /> PNG
          </button>
          <button
            type="button"
            onClick={() => doExport(exportCanvasSvg)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg"
            title="Exportar SVG"
          >
            <FileDown size={13} /> SVG
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowLayers((v) => !v)}
            className={[
              'flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg',
              showLayers
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'text-muted-foreground hover:bg-muted',
            ].join(' ')}
          >
            <Layers size={13} /> <span className="hidden sm:inline">Capas</span>
          </button>
        </div>
        <div className="flex-1 min-h-0">
          {isLoading || !ready ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">
              Cargando lienzo...
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="h-full grid place-items-center text-sm text-muted-foreground">
                  Cargando editor...
                </div>
              }
            >
              <CanvasStage
                initialElements={deriveScene(elementsRef.current, layers)}
                initialAppState={appStateRef.current}
                initialFiles={{}}
                onExcalidrawAPI={(api) => {
                  apiRef.current = api
                }}
                onChange={handleChange}
                onPointerUpdate={handlePointer}
              />
            </Suspense>
          )}
        </div>
      </div>

      <CanvasLayersPanel
        open={showLayers}
        onOpenChange={setShowLayers}
        isMobile={isMobile}
        onAddLayer={addLayer}
        layers={layers}
        {...layerCbs}
      />
    </div>
  )
}
