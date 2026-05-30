import { useEffect, useRef, useState, useCallback } from 'react'
import grapesjs from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
import { buildGrapesConfig } from './atlasGrapesConfig.js'
import { getApiUrl } from '../lib/runtimeConfig.js'
import { TemplatePickerModal } from './TemplatePickerModal.jsx'

async function loadAtlasImages(editor, token) {
  const apiUrl = getApiUrl()
  try {
    const listRes = await fetch(`${apiUrl}/files?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!listRes.ok) return
    const listData = await listRes.json()
    const imageFiles = (listData.data ?? []).filter((f) => f.mimeType?.startsWith('image/'))
    if (!imageFiles.length) return

    const urlsRes = await fetch(`${apiUrl}/files/batch-signed-urls`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: imageFiles.map((f) => f.id) }),
    })
    if (!urlsRes.ok) return
    const urlsData = await urlsRes.json()
    const urlMap = urlsData.data ?? {}

    const assets = imageFiles
      .filter((f) => urlMap[f.id])
      .map((f) => ({
        src: urlMap[f.id],
        name: f.originalName ?? f.id,
        type: 'image',
      }))

    if (assets.length) editor.AssetManager.add(assets)
  } catch (err) {
    console.warn('[atlas-files] could not load images into editor:', err.message)
  }
}

// actionsRef — optional ref passed by parent to call getLatestData() before save/publish
export function WebsiteGrapesEditor({ initialData, onDataChange, height, token, siteId, actionsRef }) {
  const containerRef  = useRef(null)
  const editorRef     = useRef(null)
  const onChangeRef   = useRef(onDataChange)
  const emitTimer     = useRef(null)
  const rteActive     = useRef(false)   // true while user is typing in RTE
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => { onChangeRef.current = onDataChange }, [onDataChange])

  const handleHomePageApplied = useCallback(({ html, css }) => {
    const editor = editorRef.current
    if (!editor) return
    editor.DomComponents.clear()
    editor.setStyle('')
    editor.setComponents(html)
    if (css) editor.setStyle(css)
    clearTimeout(emitTimer.current)
    emitTimer.current = setTimeout(() => {
      if (!editorRef.current) return
      onChangeRef.current?.({
        gjsProjectData: editorRef.current.getProjectData(),
        html: editorRef.current.getHtml(),
        css: editorRef.current.getCss(),
      })
    }, 600)
  }, [])

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return

    const apiUrl = getApiUrl()
    const editor = grapesjs.init(buildGrapesConfig(containerRef.current, { token, apiUrl }))

    if (initialData?.gjsProjectData) {
      editor.loadProjectData(initialData.gjsProjectData)
    }

    // ── Serialization helpers ────────────────────────────────────────────────
    const getEditorData = () => ({
      gjsProjectData: editor.getProjectData(),
      html: editor.getHtml(),
      css: editor.getCss(),
    })

    // serialize() — guarded: never fires while RTE is active.
    //
    // Root cause of cursor-at-position-0 bug:
    //   Calling editor.getHtml() / getProjectData() while a contenteditable
    //   is focused causes GrapesJS to re-apply innerHTML to the DOM node,
    //   which moves the browser cursor to position 0.
    //   This happens for ANY event path (component:update, style:update, etc.)
    //   because GrapesJS fires style:update internally when CSS classes on
    //   typed components are re-evaluated — even during text input.
    const serialize = () => {
      if (!editorRef.current) return
      if (rteActive.current) return      // guard: cursor would reset if we proceed
      onChangeRef.current?.(getEditorData())
    }

    // Expose synchronous data getter for parent (bypasses debounce on save/publish)
    if (actionsRef) {
      actionsRef.current = { getLatestData: getEditorData }
    }

    // ── RTE tracking ─────────────────────────────────────────────────────────
    const onRteEnable  = () => { rteActive.current = true }
    const onRteDisable = () => {
      rteActive.current = false
      // Capture all edits (text + styles) once user leaves the text field
      clearTimeout(emitTimer.current)
      emitTimer.current = setTimeout(serialize, 300)
    }

    editor.on('rte:enable',  onRteEnable)
    editor.on('rte:disable', onRteDisable)

    // ── Change handlers ──────────────────────────────────────────────────────
    // ALL handlers call serialize() which itself checks rteActive — so any
    // event fired by GrapesJS internally during typing is safely ignored.

    const onStructureChange = () => {
      clearTimeout(emitTimer.current)
      emitTimer.current = setTimeout(serialize, 120)
    }

    const onContentChange = () => {
      clearTimeout(emitTimer.current)
      emitTimer.current = setTimeout(serialize, 400)
    }

    const onStyleChange = () => {
      clearTimeout(emitTimer.current)
      emitTimer.current = setTimeout(serialize, 80)
    }

    editor.on('component:add component:remove', onStructureChange)
    editor.on('component:update',               onContentChange)
    editor.on('style:update',                   onStyleChange)

    // Template picker
    editor.Commands.add('atlas-show-templates', { run: () => setShowTemplates(true) })
    editor.Panels.addButton('options', {
      id: 'atlas-templates-btn',
      command: 'atlas-show-templates',
      label: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
      attributes: { title: 'Plantillas de pagina' },
    })

    editorRef.current = editor
    const initTimer = setTimeout(serialize, 400)
    if (token) loadAtlasImages(editor, token)

    return () => {
      clearTimeout(initTimer)
      clearTimeout(emitTimer.current)
      if (actionsRef) actionsRef.current = null
      // Force-serialize final state so style changes aren't lost on unmount
      try {
        if (onChangeRef.current) onChangeRef.current(getEditorData())
      } catch (_) { /* ignore errors during destroy */ }
      editor.off('rte:enable',  onRteEnable)
      editor.off('rte:disable', onRteDisable)
      editor.off('component:add component:remove', onStructureChange)
      editor.off('component:update',               onContentChange)
      editor.off('style:update',                   onStyleChange)
      editor.destroy()
      editorRef.current = null
    }
  }, []) // intentionally empty — editor mounts once

  return (
    <>
      <div ref={containerRef} style={{ height: height || '100%', width: '100%' }} />
      <TemplatePickerModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        token={token}
        siteId={siteId ?? null}
        onHomePageApplied={handleHomePageApplied}
      />
    </>
  )
}
