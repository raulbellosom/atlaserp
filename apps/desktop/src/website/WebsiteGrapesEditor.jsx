import { useEffect, useRef, useState, useCallback } from 'react'
import grapesjs from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
import { buildGrapesConfig } from './atlasGrapesConfig.js'
import { allTemplates } from './atlasTemplates/index.js'
import { getApiUrl } from '../lib/runtimeConfig.js'

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

function TemplatePickerModal({ onClose, onApply }) {
  const [selected, setSelected] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const handleApply = () => {
    if (!selected) return
    if (!confirming) { setConfirming(true); return }
    onApply(selected)
    onClose()
  }

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth:'860px', maxHeight:'88vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ padding:'24px 28px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ margin:0, fontSize:'20px', fontWeight:800, color:'#0f172a', letterSpacing:'-0.02em' }}>Plantillas</h2>
            <p style={{ margin:'4px 0 0', fontSize:'14px', color:'#64748b' }}>Elige una plantilla para comenzar. Reemplazara el contenido actual.</p>
          </div>
          <button onClick={onClose} style={{ background:'#f1f5f9', border:'none', borderRadius:'8px', width:'36px', height:'36px', cursor:'pointer', fontSize:'18px', color:'#64748b' }}>&times;</button>
        </div>

        <div style={{ overflowY:'auto', padding:'24px 28px', flex:1 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'16px' }}>
            {allTemplates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => { setSelected(tpl); setConfirming(false) }}
                style={{ border: selected?.id === tpl.id ? `2px solid ${tpl.color}` : '2px solid #e2e8f0', borderRadius:'14px', cursor:'pointer', overflow:'hidden', transition:'border-color 0.15s', boxShadow: selected?.id === tpl.id ? `0 0 0 3px ${tpl.color}22` : 'none' }}
              >
                <div style={{ height:'96px', background:`linear-gradient(135deg, ${tpl.color} 0%, ${tpl.color}bb 100%)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:'32px', fontWeight:900, color:'rgba(255,255,255,0.25)', textTransform:'uppercase' }}>{tpl.label.charAt(0)}</span>
                </div>
                <div style={{ padding:'14px 16px' }}>
                  <p style={{ margin:'0 0 4px', fontSize:'15px', fontWeight:700, color:'#0f172a' }}>{tpl.label}</p>
                  <p style={{ margin:0, fontSize:'13px', color:'#64748b', lineHeight:'1.5' }}>{tpl.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding:'16px 28px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
          <p style={{ margin:0, fontSize:'13px', color: confirming ? '#dc2626' : '#94a3b8' }}>
            {confirming ? 'Esta accion reemplazara todo el contenido actual.' : selected ? `Seleccionada: ${selected.label}` : 'Selecciona una plantilla'}
          </p>
          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={onClose} style={{ background:'#f1f5f9', border:'none', color:'#374151', fontSize:'14px', fontWeight:600, padding:'10px 20px', borderRadius:'8px', cursor:'pointer' }}>Cancelar</button>
            <button onClick={handleApply} disabled={!selected} style={{ background: !selected ? '#e2e8f0' : confirming ? '#dc2626' : '#4f46e5', border:'none', color: !selected ? '#94a3b8' : 'white', fontSize:'14px', fontWeight:700, padding:'10px 24px', borderRadius:'8px', cursor: selected ? 'pointer' : 'not-allowed' }}>
              {confirming ? 'Confirmar y aplicar' : 'Aplicar plantilla'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// actionsRef — optional ref passed by parent to call getLatestData() before save/publish
export function WebsiteGrapesEditor({ initialData, onDataChange, height, token, actionsRef }) {
  const containerRef  = useRef(null)
  const editorRef     = useRef(null)
  const onChangeRef   = useRef(onDataChange)
  const emitTimer     = useRef(null)
  const rteActive     = useRef(false)   // true while user is typing in RTE
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => { onChangeRef.current = onDataChange }, [onDataChange])

  const handleApplyTemplate = useCallback((template) => {
    const editor = editorRef.current
    if (!editor) return
    // Support both old flat format (html/css) and new multi-page format (pages[])
    const homePage = template.pages ? template.pages[0] : template
    const html = homePage.html ?? ''
    const css = homePage.css ?? ''
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
      {showTemplates && (
        <TemplatePickerModal onClose={() => setShowTemplates(false)} onApply={handleApplyTemplate} />
      )}
    </>
  )
}
