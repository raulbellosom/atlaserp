import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Layers, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { supabase } from '../../../lib/supabase'
import { useIsDark } from '../hooks/useIsDark.js'
import { useCanvasScene, useSaveCanvasScene } from '../hooks/useCanvasScene.js'
import {
  ensureLayers,
  defaultLayer,
  assignLayer,
  deriveScene,
  mergeVisibleBack,
  setLayerOpacity,
  setLayerLocked,
  moveElementsToLayer,
  groupElementsByLayer,
  setElementHidden,
  setElementLocked,
  deleteElement,
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

function filesArrayToMap(arr) {
  const map = {}
  for (const f of arr) map[f.id] = f
  return map
}

// Top-first list from the panel -> normalised ascending `order` (index 0 in the
// panel is the frontmost layer = highest order).
function orderFromTopFirst(topFirst) {
  const n = topFirst.length
  return topFirst.map((l, i) => ({ ...l, order: n - 1 - i }))
}

export function CanvasEditor({ note }) {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const noteId = note?.id
  const isDark = useIsDark()

  const { data, isLoading, error } = useCanvasScene(noteId)
  const saveScene = useSaveCanvasScene(noteId)
  const saveRef = useRef(saveScene)
  saveRef.current = saveScene

  // ── source of truth (refs, never fed back into <Excalidraw> as props) ──
  const elementsRef = useRef([])
  const filesManifestRef = useRef({})
  const appStateRef = useRef({})
  const [layers, setLayers] = useState([defaultLayer()])
  const layersRef = useRef(layers)
  layersRef.current = layers
  const [activeLayerId, setActiveLayerId] = useState(null)
  const activeLayerIdRef = useRef(null)
  activeLayerIdRef.current = activeLayerId

  const [ready, setReady] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
  const showLayersRef = useRef(false)
  showLayersRef.current = showLayers
  const [isMobile, setIsMobile] = useState(false)
  const [selectionCount, setSelectionCount] = useState(0)
  const selectionRef = useRef(0)
  // Bumped (throttled) on element changes while the layers panel is open, so the
  // panel's per-layer shape list stays roughly live without re-rendering
  // <CanvasStage> (memoised — a CanvasEditor re-render never reaches it).
  const [elementsVersion, setElementsVersion] = useState(0)
  const lastElementsBump = useRef(0)

  // The ONE frozen object handed to <Excalidraw>. Built once when the scene has
  // loaded; its identity must never change afterwards (see CanvasStage).
  const initialDataRef = useRef(null)

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

  // Seed from the server scene once loaded, then reveal the editor.
  useEffect(() => {
    if (!data?.scene || ready) return
    let cancelled = false
    ;(async () => {
      const s = data.scene
      elementsRef.current = Array.isArray(s.elements) ? s.elements : []
      const ls = ensureLayers(s.layers)
      const topLayer = [...ls].sort((a, b) => b.order - a.order)[0]
      filesManifestRef.current = s.files ?? {}
      appStateRef.current = s.appState ?? {}
      const fileArr = await hydrateImages(s.files)
      if (cancelled) return
      initialDataRef.current = {
        elements: deriveScene(elementsRef.current, ls),
        appState: { ...(s.appState ?? {}), collaborators: new Map() },
        files: filesArrayToMap(fileArr),
        scrollToContent: true,
      }
      setLayers(ls)
      setActiveLayerId(topLayer.id)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [data?.scene, ready])

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
      },
      onRemoteSnapshot: async (snap) => {
        elementsRef.current = Array.isArray(snap.elements) ? snap.elements : elementsRef.current
        if (Array.isArray(snap.layers) && snap.layers.length) setLayers(ensureLayers(snap.layers))
        if (snap.appState) appStateRef.current = snap.appState
        if (snap.files && typeof snap.files === 'object') {
          filesManifestRef.current = snap.files
          try {
            const arr = await hydrateImages(snap.files)
            if (arr.length) apiRef.current?.addFiles(arr)
          } catch {
            /* best effort */
          }
        }
        apiRef.current?.updateScene({
          elements: deriveScene(elementsRef.current, snap.layers ?? layersRef.current),
        })
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
      saveRef.current.mutate({
        elements: elementsRef.current,
        appState: appStateRef.current,
        layers: layersRef.current,
        files: filesManifestRef.current,
      })
    }, AUTOSAVE_DELAY)
  }, [])

  // Flush once on unmount so a fast note switch never drops the last edits.
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current)
      if (elementsRef.current.length || Object.keys(filesManifestRef.current).length) {
        saveRef.current.mutate({
          elements: elementsRef.current,
          appState: appStateRef.current,
          layers: layersRef.current,
          files: filesManifestRef.current,
        })
      }
    },
    [],
  )

  // Stable — never re-created, so <CanvasStage> (memo) never re-renders.
  const handleExcalidrawAPI = useCallback((api) => {
    apiRef.current = api
    // Make sure a reloaded drawing is actually in view (we deliberately don't
    // persist scroll/zoom, so the viewport starts at the origin).
    requestAnimationFrame(() => {
      const els = api.getSceneElements?.() ?? []
      if (els.length) {
        try {
          api.scrollToContent?.(els, { fitToContent: true, animate: false })
        } catch {
          /* older signature */
          api.scrollToContent?.()
        }
      }
    })
  }, [])

  const handleChange = useCallback(
    async (elements, appState) => {
      const active = activeLayerIdRef.current ?? layersRef.current[0]?.id
      const withLayers = elements.map((el) => assignLayer(el, active))
      // Excalidraw only ever hands back visible-layer elements — merge the
      // hidden ones back so the source of truth stays whole.
      elementsRef.current = mergeVisibleBack(elementsRef.current, withLayers, layersRef.current)

      const selCount = Object.keys(appState?.selectedElementIds ?? {}).length
      if (selCount !== selectionRef.current) {
        selectionRef.current = selCount
        setSelectionCount(selCount)
      }

      if (showLayersRef.current && Date.now() - lastElementsBump.current > 400) {
        lastElementsBump.current = Date.now()
        setElementsVersion((v) => v + 1)
      }

      syncRef.current?.notifyLocalChange()
      persist()

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
    [noteId, token, persist],
  )

  const handlePointer = useCallback((payload) => {
    const p = payload?.pointer
    if (!p) return
    syncRef.current?.broadcastPointer({ x: p.x, y: p.y })
  }, [])

  // Re-derive whenever layers change (visibility / order). Lock and opacity are
  // written imperatively in their callbacks, so this only needs layers.
  useEffect(() => {
    if (ready) apiRef.current?.updateScene({ elements: deriveScene(elementsRef.current, layers) })
  }, [layers, ready])

  const layerElements = useMemo(
    () => groupElementsByLayer(elementsRef.current, layers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layers, showLayers, elementsVersion],
  )

  const mutateLayers = useCallback(
    (next) => {
      setLayers(next)
      persist()
    },
    [persist],
  )

  // Apply an already-computed element list: update the ref, the visible scene,
  // broadcast, persist, and refresh the panel's shape list.
  const applyElements = useCallback(
    (nextElements) => {
      elementsRef.current = nextElements
      apiRef.current?.updateScene({ elements: deriveScene(nextElements, layersRef.current) })
      syncRef.current?.notifyLocalChange()
      persist()
      setElementsVersion((v) => v + 1)
    },
    [persist],
  )

  const childHandlers = {
    onSelectElement: (id) => {
      const api = apiRef.current
      if (!api) return
      const el = elementsRef.current.find((e) => e.id === id)
      api.updateScene({ appState: { selectedElementIds: { [id]: true } } })
      if (el) {
        try {
          api.scrollToContent?.([el], { fitToContent: true, animate: true })
        } catch {
          /* older signature */
        }
      }
    },
    onToggleElementHidden: (id) => {
      const el = elementsRef.current.find((e) => e.id === id)
      applyElements(setElementHidden(elementsRef.current, id, !el?.customData?.hidden))
    },
    onToggleElementLocked: (id) => {
      const el = elementsRef.current.find((e) => e.id === id)
      applyElements(setElementLocked(elementsRef.current, id, !el?.locked))
    },
    onDeleteElement: (id) => {
      applyElements(deleteElement(elementsRef.current, id))
    },
  }

  const layerCbs = {
    activeLayerId,
    layerElements,
    childHandlers,
    onSelect: setActiveLayerId,
    onRename: (id, name) => mutateLayers(layers.map((l) => (l.id === id ? { ...l, name } : l))),
    onSetColor: (id, color) => mutateLayers(layers.map((l) => (l.id === id ? { ...l, color } : l))),
    onToggleVisible: (id) =>
      mutateLayers(layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))),
    onToggleLocked: (id) => {
      const layer = layers.find((l) => l.id === id)
      const nextLocked = !layer?.locked
      elementsRef.current = setLayerLocked(elementsRef.current, id, nextLocked)
      apiRef.current?.updateScene({ elements: deriveScene(elementsRef.current, layers) })
      mutateLayers(layers.map((l) => (l.id === id ? { ...l, locked: nextLocked } : l)))
    },
    onOpacity: (id, opacity) => {
      elementsRef.current = setLayerOpacity(elementsRef.current, id, opacity)
      apiRef.current?.updateScene({ elements: deriveScene(elementsRef.current, layers) })
      mutateLayers(layers.map((l) => (l.id === id ? { ...l, opacity } : l)))
    },
    onReorderList: (topFirst) => mutateLayers(orderFromTopFirst(topFirst)),
    onMoveSelectionHere: (layerId) => {
      const api = apiRef.current
      const sel = api?.getAppState?.().selectedElementIds ?? {}
      const idSet = new Set(Object.keys(sel).filter((k) => sel[k]))
      if (!idSet.size) return
      elementsRef.current = moveElementsToLayer(elementsRef.current, idSet, layerId)
      api?.updateScene({ elements: deriveScene(elementsRef.current, layersRef.current) })
      syncRef.current?.notifyLocalChange()
      persist()
      setActiveLayerId(layerId)
      toast.success(`${idSet.size} elemento${idSet.size === 1 ? '' : 's'} movido${idSet.size === 1 ? '' : 's'}`)
    },
    onDuplicate: (id) => {
      const { layers: nl, elements: ne } = duplicateLayer(layers, elementsRef.current, id)
      elementsRef.current = ne
      mutateLayers(nl)
    },
    onMergeDown: (id) => {
      const { layers: nl, elements: ne } = mergeDown(layers, elementsRef.current, id)
      elementsRef.current = ne
      mutateLayers(nl)
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
    },
  }

  const addLayer = () => {
    const order = layers.length
    const nl = [...layers, defaultLayer(`Capa ${order + 1}`, order)]
    setActiveLayerId(nl[nl.length - 1].id)
    mutateLayers(nl)
  }

  const exportScoped = useCallback(
    async (scope, format) => {
      const api = apiRef.current
      let elements
      if (scope === 'selection') {
        const sel = api?.getAppState?.().selectedElementIds ?? {}
        elements = (api?.getSceneElements?.() ?? []).filter((e) => sel[e.id])
        if (!elements.length) {
          toast.info('No hay elementos seleccionados')
          return
        }
      } else {
        elements = deriveScene(elementsRef.current, layersRef.current)
      }
      const args = {
        elements,
        appState: appStateRef.current,
        files: api?.getFiles?.() ?? {},
        title: note?.title,
      }
      try {
        await (format === 'png' ? exportCanvasPng(args) : exportCanvasSvg(args))
      } catch (err) {
        toast.error(err?.message ?? 'No se pudo exportar')
      }
    },
    [note?.title],
  )

  if (error) {
    return <div className="p-8 text-sm text-muted-foreground">No se pudo cargar el lienzo.</div>
  }

  return (
    <div className="relative flex h-full min-h-0">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-1 px-3 h-11 border-b border-border shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg"
              >
                <FileDown size={13} /> Exportar
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Todo el lienzo</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => exportScoped('all', 'png')}>PNG</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportScoped('all', 'svg')}>SVG</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Seleccion</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => exportScoped('selection', 'png')}>PNG</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportScoped('selection', 'svg')}>SVG</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                initialData={initialDataRef.current}
                theme={isDark ? 'dark' : 'light'}
                onExcalidrawAPI={handleExcalidrawAPI}
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
        selectionCount={selectionCount}
        {...layerCbs}
      />
    </div>
  )
}
