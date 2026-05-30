# Website Templates Multi-página — Plan B: Picker UI + Admin + Login de Clientes

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisito:** Plan A completado (`2026-05-30-website-templates-multipage-A.md`). Todos los templates tienen formato `pages[]`.

**Goal:** Implementar el picker de 2 pasos para templates multi-página, la pantalla de Plantillas en el admin del website, y el login de clientes público en `/acceso`.

**Architecture:** `TemplatePickerModal` se extrae de `WebsiteGrapesEditor.jsx` a su propio archivo con 2 pasos: elegir template → elegir páginas (con API calls para crear/actualizar páginas). `WebsiteTemplatesScreen` es una nueva pantalla admin que abre el mismo modal. `PublicClientLogin` usa `supabase.auth.signInWithPassword` + un endpoint nuevo `GET /public/website/auth-check` para decidir el redirect según rol.

**Tech Stack:** React 18, TanStack Query, Hono, `@supabase/supabase-js`, Tailwind (CSS variables), JavaScript ES modules.

---

## File Map

### Crear
- `apps/desktop/src/website/TemplatePickerModal.jsx` — modal standalone de 2 pasos con API calls
- `apps/desktop/src/shell/PublicClientLogin.jsx` — login público de clientes
- `apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx` — pantalla admin

### Modificar
- `apps/desktop/src/website/WebsiteGrapesEditor.jsx` — usa el nuevo modal, añade prop `siteId`
- `apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx` — pasa `siteId` al editor
- `apps/desktop/src/modules/atlas.website/screens/WebsitePagesScreen.jsx` — botón template en empty state
- `apps/desktop/src/app/ModuleOutlet.jsx` — registrar `WebsiteTemplatesScreen`
- `apps/api/src/manifests/official/feature-modules.js` — añadir nav entry "Plantillas"
- `apps/api/src/routes/public-website.js` — añadir endpoint `GET /auth-check`
- `apps/desktop/src/main.jsx` — añadir ruta `/acceso`

---

## Task 1 — Crear TemplatePickerModal.jsx (2 pasos + API)

**Files:**
- Create: `apps/desktop/src/website/TemplatePickerModal.jsx`

Este componente reemplaza el `TemplatePickerModal` inline que actualmente existe en `WebsiteGrapesEditor.jsx`. Tiene 2 pasos y hace las llamadas API.

**Props:**
- `isOpen: bool` — controla visibilidad
- `onClose: fn()` — cierra el modal
- `token: string` — JWT para API calls
- `siteId: string | null` — ID del sitio (si null, solo carga la home en el editor sin crear páginas extra)
- `onHomePageApplied: fn({ html, css })` — llamado después de crear páginas; recibe la home page

- [ ] **Step 1: Crear el archivo**

  ```jsx
  // apps/desktop/src/website/TemplatePickerModal.jsx
  import { useState } from 'react'
  import { allTemplates } from './atlasTemplates/index.js'
  import { getApiUrl } from '../lib/runtimeConfig.js'

  const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

  const CATEGORY_LABELS = {
    all: 'Todos',
    hosteleria: 'Hosteleria',
    bienestar: 'Bienestar',
    tecnologia: 'Tecnologia',
    comercio: 'Comercio',
    negocios: 'Negocios',
    salud: 'Salud',
    creativo: 'Creativo',
    medios: 'Medios',
    educacion: 'Educacion',
    social: 'Social',
  }

  async function createOrUpdatePage({ token, siteId, page }) {
    const apiUrl = getApiUrl()
    // Check if route already exists
    const listRes = await fetch(`${apiUrl}/website/pages?siteId=${siteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const listData = listRes.ok ? await listRes.json() : { data: [] }
    const existing = (listData.data ?? []).find((p) => p.routePath === page.routePath)

    if (existing) {
      // Update draft builder data
      const patchRes = await fetch(`${apiUrl}/website/pages/${existing.id}/save-draft`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ builderData: { html: page.html, css: page.css ?? '' } }),
      })
      if (!patchRes.ok) throw new Error(`Error al actualizar pagina ${page.routePath}`)
      return existing
    } else {
      // Create new page
      const slug = page.routePath === '/' ? 'home' : page.routePath.replace(/^\//, '').replace(/\//g, '-')
      const createRes = await fetch(`${apiUrl}/website/pages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          title: page.title,
          slug,
          routePath: page.routePath,
          pageType: 'page',
          visibility: 'public',
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}))
        throw new Error(err.error || `Error al crear pagina ${page.routePath}`)
      }
      const created = await createRes.json()
      // Save draft HTML/CSS
      await fetch(`${apiUrl}/website/pages/${created.id}/save-draft`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ builderData: { html: page.html, css: page.css ?? '' } }),
      })
      return created
    }
  }

  export function TemplatePickerModal({ isOpen, onClose, token, siteId, onHomePageApplied }) {
    const [step, setStep] = useState(1)              // 1 = choose template, 2 = choose pages
    const [selected, setSelected] = useState(null)
    const [enabledPages, setEnabledPages] = useState({})
    const [applying, setApplying] = useState(false)
    const [error, setError] = useState(null)
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [confirmReplace, setConfirmReplace] = useState(false)

    if (!isOpen) return null

    const categories = ['all', ...new Set(allTemplates.map((t) => t.category).filter(Boolean))]
    const filtered = categoryFilter === 'all'
      ? allTemplates
      : allTemplates.filter((t) => t.category === categoryFilter)

    function handleSelectTemplate(tpl) {
      setSelected(tpl)
      // Default: all pages enabled
      const defaults = {}
      tpl.pages.forEach((p) => { defaults[p.id] = true })
      setEnabledPages(defaults)
      setConfirmReplace(false)
      setError(null)
    }

    function handleNextStep() {
      if (!selected) return
      setStep(2)
    }

    function togglePage(pageId, required) {
      if (required) return
      setEnabledPages((prev) => ({ ...prev, [pageId]: !prev[pageId] }))
    }

    function selectedPages() {
      return selected.pages.filter((p) => enabledPages[p.id])
    }

    async function handleApply() {
      if (!selected) return
      if (!confirmReplace) { setConfirmReplace(true); return }

      setApplying(true)
      setError(null)
      try {
        const pagesToCreate = selectedPages()
        const homePage = pagesToCreate.find((p) => p.routePath === '/')

        if (siteId && token) {
          for (const page of pagesToCreate) {
            await createOrUpdatePage({ token, siteId, page })
          }
        }

        // Load home page into editor
        if (homePage) {
          onHomePageApplied({ html: homePage.html, css: homePage.css ?? '' })
        }
        handleClose()
      } catch (err) {
        setError(err.message || 'Error al aplicar la plantilla')
      } finally {
        setApplying(false)
      }
    }

    function handleClose() {
      setStep(1)
      setSelected(null)
      setEnabledPages({})
      setConfirmReplace(false)
      setError(null)
      onClose()
    }

    const selectedCount = selected ? selectedPages().length : 0

    return (
      <div
        style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <div style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth: step === 1 ? '920px' : '560px', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>

          {/* Header */}
          <div style={{ padding:'24px 28px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div>
              <h2 style={{ margin:0, fontSize:'20px', fontWeight:800, color:'#0f172a' }}>
                {step === 1 ? 'Elegir plantilla' : `Paginas — ${selected?.label}`}
              </h2>
              <p style={{ margin:'4px 0 0', fontSize:'14px', color:'#64748b' }}>
                {step === 1
                  ? 'Selecciona una plantilla para tu sitio.'
                  : 'Elige que paginas deseas crear. Las marcadas en gris son obligatorias.'}
              </p>
            </div>
            <button onClick={handleClose} style={{ background:'#f1f5f9', border:'none', borderRadius:'8px', width:'36px', height:'36px', cursor:'pointer', fontSize:'18px', color:'#64748b' }}>&times;</button>
          </div>

          {/* Step 1: template grid */}
          {step === 1 && (
            <>
              {/* Category chips */}
              <div style={{ padding:'16px 28px 0', display:'flex', gap:'8px', flexWrap:'wrap', flexShrink:0 }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    style={{ background: categoryFilter === cat ? '#0f172a' : '#f1f5f9', color: categoryFilter === cat ? 'white' : '#374151', border:'none', borderRadius:'999px', padding:'6px 14px', fontSize:'13px', fontWeight:600, cursor:'pointer' }}
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                  </button>
                ))}
              </div>
              <div style={{ overflowY:'auto', padding:'20px 28px', flex:1 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'16px' }}>
                  {filtered.map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl)}
                      style={{ border: selected?.id === tpl.id ? `2px solid ${tpl.color}` : '2px solid #e2e8f0', borderRadius:'14px', cursor:'pointer', overflow:'hidden', transition:'border-color 0.15s', boxShadow: selected?.id === tpl.id ? `0 0 0 3px ${tpl.color}22` : 'none' }}
                    >
                      <div style={{ height:'88px', background:`linear-gradient(135deg, ${tpl.color} 0%, ${tpl.color}bb 100%)`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                        <span style={{ fontSize:'28px', fontWeight:900, color:'rgba(255,255,255,0.2)', textTransform:'uppercase' }}>{tpl.label.charAt(0)}</span>
                        {tpl.category && (
                          <span style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.25)', color:'white', fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'999px', textTransform:'uppercase', letterSpacing:'0.05em' }}>{tpl.category}</span>
                        )}
                      </div>
                      <div style={{ padding:'14px 16px' }}>
                        <p style={{ margin:'0 0 4px', fontSize:'15px', fontWeight:700, color:'#0f172a' }}>{tpl.label}</p>
                        <p style={{ margin:'0 0 10px', fontSize:'13px', color:'#64748b', lineHeight:'1.5' }}>{tpl.description}</p>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                          {(tpl.pages ?? []).map((p) => (
                            <span key={p.id} style={{ background:'#f1f5f9', color:'#475569', fontSize:'11px', fontWeight:600, padding:'2px 8px', borderRadius:'999px' }}>{p.label}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding:'16px 28px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'10px', flexShrink:0 }}>
                <button onClick={handleClose} style={{ background:'#f1f5f9', border:'none', color:'#374151', fontSize:'14px', fontWeight:600, padding:'10px 20px', borderRadius:'8px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={handleNextStep} disabled={!selected} style={{ background: !selected ? '#e2e8f0' : '#4f46e5', border:'none', color: !selected ? '#94a3b8' : 'white', fontSize:'14px', fontWeight:700, padding:'10px 24px', borderRadius:'8px', cursor: selected ? 'pointer' : 'not-allowed' }}>
                  Siguiente &rarr;
                </button>
              </div>
            </>
          )}

          {/* Step 2: page selection */}
          {step === 2 && selected && (
            <>
              <div style={{ overflowY:'auto', padding:'20px 28px', flex:1 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {selected.pages.map((page) => (
                    <div
                      key={page.id}
                      onClick={() => togglePage(page.id, page.required)}
                      style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 18px', borderRadius:'12px', border: `2px solid ${enabledPages[page.id] ? '#4f46e5' : '#e2e8f0'}`, background: enabledPages[page.id] ? '#f5f3ff' : 'white', cursor: page.required ? 'default' : 'pointer', transition:'all 0.15s', opacity: page.required ? 0.9 : 1 }}
                    >
                      <div style={{ width:'20px', height:'20px', borderRadius:'5px', border:`2px solid ${enabledPages[page.id] ? '#4f46e5' : '#cbd5e1'}`, background: enabledPages[page.id] ? '#4f46e5' : 'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {enabledPages[page.id] && <span style={{ color:'white', fontSize:'13px', fontWeight:900 }}>✓</span>}
                      </div>
                      <div style={{ flex:1 }}>
                        <span style={{ fontSize:'15px', fontWeight:700, color:'#0f172a' }}>{page.label}</span>
                        <span style={{ fontSize:'13px', color:'#94a3b8', marginLeft:'10px', fontFamily:'monospace' }}>{page.routePath}</span>
                      </div>
                      {page.required && (
                        <span style={{ fontSize:'11px', fontWeight:700, color:'#6366f1', background:'#e0e7ff', padding:'3px 10px', borderRadius:'999px' }}>Requerida</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {error && (
                <div style={{ margin:'0 28px', padding:'12px 16px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', color:'#dc2626', fontSize:'13px' }}>
                  {error}
                </div>
              )}
              <div style={{ padding:'16px 28px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexShrink:0 }}>
                <button onClick={() => { setStep(1); setConfirmReplace(false); setError(null) }} style={{ background:'#f1f5f9', border:'none', color:'#374151', fontSize:'14px', fontWeight:600, padding:'10px 20px', borderRadius:'8px', cursor:'pointer' }}>
                  &larr; Volver
                </button>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px' }}>
                  {confirmReplace && !applying && (
                    <p style={{ margin:0, fontSize:'13px', color:'#dc2626', fontWeight:600 }}>
                      Las paginas con rutas existentes seran reemplazadas. ¿Confirmar?
                    </p>
                  )}
                  <button
                    onClick={handleApply}
                    disabled={applying || selectedCount === 0}
                    style={{ background: applying || selectedCount === 0 ? '#e2e8f0' : confirmReplace ? '#dc2626' : '#4f46e5', border:'none', color: applying || selectedCount === 0 ? '#94a3b8' : 'white', fontSize:'14px', fontWeight:700, padding:'10px 24px', borderRadius:'8px', cursor: applying || selectedCount === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    {applying ? 'Aplicando...' : confirmReplace ? `Confirmar y crear ${selectedCount} paginas` : `Crear ${selectedCount} pagina${selectedCount !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verificar sintaxis**

  ```bash
  node --check apps/desktop/src/website/TemplatePickerModal.jsx
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/website/TemplatePickerModal.jsx
  git commit -m "feat(website): add TemplatePickerModal with 2-step flow and API calls"
  ```

---

## Task 2 — Actualizar WebsiteGrapesEditor.jsx

**Files:**
- Modify: `apps/desktop/src/website/WebsiteGrapesEditor.jsx`

Cambios:
1. Eliminar la función `TemplatePickerModal` interna (líneas 42–101)
2. Importar el nuevo `TemplatePickerModal`
3. Añadir prop `siteId` al componente
4. Cambiar `onApply` → `onHomePageApplied` en el handler
5. Pasar `siteId` y `token` al modal

- [ ] **Step 1: Reemplazar el archivo**

  ```jsx
  // apps/desktop/src/website/WebsiteGrapesEditor.jsx
  import { useEffect, useRef, useState, useCallback } from 'react'
  import grapesjs from 'grapesjs'
  import 'grapesjs/dist/css/grapes.min.css'
  import { buildGrapesConfig } from './atlasGrapesConfig.js'
  import { TemplatePickerModal } from './TemplatePickerModal.jsx'
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
        .map((f) => ({ src: urlMap[f.id], name: f.originalName ?? f.id, type: 'image' }))

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
    const rteActive     = useRef(false)
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

      const getEditorData = () => ({
        gjsProjectData: editor.getProjectData(),
        html: editor.getHtml(),
        css: editor.getCss(),
      })

      const serialize = () => {
        if (!editorRef.current) return
        if (rteActive.current) return
        onChangeRef.current?.(getEditorData())
      }

      if (actionsRef) {
        actionsRef.current = { getLatestData: getEditorData }
      }

      const onRteEnable  = () => { rteActive.current = true }
      const onRteDisable = () => {
        rteActive.current = false
        clearTimeout(emitTimer.current)
        emitTimer.current = setTimeout(serialize, 300)
      }

      editor.on('rte:enable',  onRteEnable)
      editor.on('rte:disable', onRteDisable)

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
        try {
          if (onChangeRef.current) onChangeRef.current(getEditorData())
        } catch (_) {}
        editor.off('rte:enable',  onRteEnable)
        editor.off('rte:disable', onRteDisable)
        editor.off('component:add component:remove', onStructureChange)
        editor.off('component:update',               onContentChange)
        editor.off('style:update',                   onStyleChange)
        editor.destroy()
        editorRef.current = null
      }
    }, []) // eslint-disable-line

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
  ```

- [ ] **Step 2: Verificar sintaxis**

  ```bash
  node --check apps/desktop/src/website/WebsiteGrapesEditor.jsx
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/website/WebsiteGrapesEditor.jsx
  git commit -m "feat(website): update WebsiteGrapesEditor to use standalone TemplatePickerModal with siteId prop"
  ```

---

## Task 3 — Pasar siteId desde WebsitePageEditorScreen

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx`

La página query ya carga los datos del page incluyendo `site_id`. Solo hay que pasarlo al editor.

- [ ] **Step 1: Localizar el `<WebsiteGrapesEditor>` (línea ~111) y añadir prop `siteId`**

  Cambiar:
  ```jsx
  <WebsiteGrapesEditor
    initialData={pageQuery.data?.draftBuilderData ?? null}
    onDataChange={(data) => { grapesDataRef.current = data }}
    height="100%"
    token={token}
  />
  ```
  Por:
  ```jsx
  <WebsiteGrapesEditor
    initialData={pageQuery.data?.draftBuilderData ?? null}
    onDataChange={(data) => { grapesDataRef.current = data }}
    height="100%"
    token={token}
    siteId={pageQuery.data?.site_id ?? pageQuery.data?.siteId ?? null}
  />
  ```

- [ ] **Step 2: Verificar sintaxis**

  ```bash
  node --check apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx
  git commit -m "feat(website): pass siteId to WebsiteGrapesEditor from page editor"
  ```

---

## Task 4 — Botón "Empezar desde plantilla" en WebsitePagesScreen

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsitePagesScreen.jsx`

Cuando `pages.length === 0` (línea ~106), añadir un botón adicional que abra el modal de templates directamente en el contexto del siteId.

- [ ] **Step 1: Añadir import del modal**

  Después de `import WebsiteNewPageDialog from './WebsiteNewPageDialog.jsx'`, añadir:
  ```js
  import { TemplatePickerModal } from '../../../website/TemplatePickerModal.jsx'
  ```

- [ ] **Step 2: Añadir estado para el modal de templates**

  Después de `const [dialogOpen, setDialogOpen] = useState(false)`, añadir:
  ```js
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  ```

- [ ] **Step 3: Actualizar el empty state (buscar el bloque `pages.length === 0`)**

  Cambiar el bloque:
  ```jsx
  ) : pages.length === 0 ? (
    <div className="rounded-xl border border-[hsl(var(--border))] p-10 text-center space-y-4">
      <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay paginas creadas aun.</p>
      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        Crear primera pagina
      </Button>
    </div>
  ```
  Por:
  ```jsx
  ) : pages.length === 0 ? (
    <div className="rounded-xl border border-[hsl(var(--border))] p-10 text-center space-y-6">
      <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay paginas creadas aun.</p>
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTemplatePickerOpen(true)}
          className="gap-2"
        >
          Empezar desde plantilla
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
          Pagina en blanco
        </Button>
      </div>
    </div>
  ```

- [ ] **Step 4: Añadir el modal al return del componente**

  Antes del cierre `</div>` final del return, añadir:
  ```jsx
  <TemplatePickerModal
    isOpen={templatePickerOpen}
    onClose={() => setTemplatePickerOpen(false)}
    token={token}
    siteId={siteId}
    onHomePageApplied={() => {
      setTemplatePickerOpen(false)
      queryClient.invalidateQueries({ queryKey: ['website-pages', siteId] })
    }}
  />
  ```

- [ ] **Step 5: Verificar sintaxis**

  ```bash
  node --check apps/desktop/src/modules/atlas.website/screens/WebsitePagesScreen.jsx
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add apps/desktop/src/modules/atlas.website/screens/WebsitePagesScreen.jsx
  git commit -m "feat(website): add template picker button to empty pages state"
  ```

---

## Task 5 — Crear WebsiteTemplatesScreen.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx`

- [ ] **Step 1: Crear el archivo**

  ```jsx
  // apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx
  import { useState } from 'react'
  import { useQuery } from '@tanstack/react-query'
  import { useAuth } from '../../../auth/AuthProvider.jsx'
  import { getApiUrl } from '../../../lib/runtimeConfig.js'
  import { TemplatePickerModal } from '../../../website/TemplatePickerModal.jsx'
  import { allTemplates } from '../../../website/atlasTemplates/index.js'

  const CATEGORY_LABELS = {
    all: 'Todos',
    hosteleria: 'Hosteleria',
    bienestar: 'Bienestar',
    tecnologia: 'Tecnologia',
    comercio: 'Comercio',
    negocios: 'Negocios',
    salud: 'Salud',
    creativo: 'Creativo',
    medios: 'Medios',
    educacion: 'Educacion',
    social: 'Social',
  }

  export default function WebsiteTemplatesScreen() {
    const { session } = useAuth()
    const token = session?.access_token
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [pickerOpen, setPickerOpen] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState(null)

    const siteQuery = useQuery({
      queryKey: ['website-site', token],
      queryFn: async () => {
        const res = await fetch(`${getApiUrl()}/website/site`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      },
      enabled: Boolean(token),
      staleTime: 60_000,
    })

    const siteId = siteQuery.data?.data?.id ?? null

    const categories = ['all', ...new Set(allTemplates.map((t) => t.category).filter(Boolean))]
    const filtered = categoryFilter === 'all'
      ? allTemplates
      : allTemplates.filter((t) => t.category === categoryFilter)

    function handleApplyClick(tpl) {
      setSelectedTemplate(tpl)
      setPickerOpen(true)
    }

    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Plantillas</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Aplica una plantilla para crear multiples paginas de una vez.
          </p>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                categoryFilter === cat
                  ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
                  : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        {/* Templates grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Color header */}
              <div
                className="h-24 flex items-center justify-center relative"
                style={{ background: `linear-gradient(135deg, ${tpl.color} 0%, ${tpl.color}bb 100%)` }}
              >
                <span className="text-5xl font-black opacity-20 text-white uppercase">
                  {tpl.label.charAt(0)}
                </span>
                {tpl.category && (
                  <span className="absolute top-2 right-3 text-xs font-bold text-white bg-black/25 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {tpl.category}
                  </span>
                )}
              </div>

              <div className="p-5 space-y-3">
                <div>
                  <p className="font-bold text-[hsl(var(--foreground))]">{tpl.label}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>

                {/* Page badges */}
                <div className="flex flex-wrap gap-1.5">
                  {(tpl.pages ?? []).map((p) => (
                    <span
                      key={p.id}
                      className="text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded-full"
                    >
                      {p.label}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleApplyClick(tpl)}
                  disabled={!siteId}
                  title={!siteId ? 'Configura tu sitio web primero' : undefined}
                  className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: tpl.color,
                    color: 'white',
                  }}
                >
                  Aplicar plantilla
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Template picker modal — opens at step 2 with pre-selected template */}
        {pickerOpen && selectedTemplate && (
          <TemplatePickerModal
            isOpen={pickerOpen}
            onClose={() => { setPickerOpen(false); setSelectedTemplate(null) }}
            token={token}
            siteId={siteId}
            initialTemplate={selectedTemplate}
            onHomePageApplied={() => {
              setPickerOpen(false)
              setSelectedTemplate(null)
            }}
          />
        )}
      </div>
    )
  }
  ```

  **NOTA:** `TemplatePickerModal` necesita aceptar un prop `initialTemplate` para saltar directo al paso 2. Añade esta lógica al modal en el siguiente sub-paso.

- [ ] **Step 2: Añadir prop `initialTemplate` a TemplatePickerModal**

  En `apps/desktop/src/website/TemplatePickerModal.jsx`, actualiza la firma de props y el estado inicial:

  Cambiar:
  ```jsx
  export function TemplatePickerModal({ isOpen, onClose, token, siteId, onHomePageApplied }) {
    const [step, setStep] = useState(1)
    const [selected, setSelected] = useState(null)
    const [enabledPages, setEnabledPages] = useState({})
  ```
  Por:
  ```jsx
  export function TemplatePickerModal({ isOpen, onClose, token, siteId, onHomePageApplied, initialTemplate = null }) {
    const [step, setStep] = useState(initialTemplate ? 2 : 1)
    const [selected, setSelected] = useState(() => {
      if (!initialTemplate) return null
      return initialTemplate
    })
    const [enabledPages, setEnabledPages] = useState(() => {
      if (!initialTemplate) return {}
      const defaults = {}
      initialTemplate.pages.forEach((p) => { defaults[p.id] = true })
      return defaults
    })
  ```

- [ ] **Step 3: Verificar sintaxis**

  ```bash
  node --check apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx
  node --check apps/desktop/src/website/TemplatePickerModal.jsx
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx \
          apps/desktop/src/website/TemplatePickerModal.jsx
  git commit -m "feat(website): add WebsiteTemplatesScreen and initialTemplate prop to picker"
  ```

---

## Task 6 — Registrar WebsiteTemplatesScreen en ModuleOutlet y manifest

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`
- Modify: `apps/api/src/manifests/official/feature-modules.js`

- [ ] **Step 1: Añadir entrada al SCREEN_MAP en ModuleOutlet.jsx**

  Busca el bloque de entradas `atlas.website:*` (líneas ~94–116). Después de `"atlas.website:/pages"`, añadir:
  ```js
  "atlas.website:/templates": lazy(
    () => import("../modules/atlas.website/screens/WebsiteTemplatesScreen.jsx"),
  ),
  ```

- [ ] **Step 2: Añadir nav entry al manifest en feature-modules.js**

  Localiza el array `navigation` de `atlasWebsiteManifest` (línea ~315). Después de la entrada `'Paginas'`, insertar:
  ```js
  { label: 'Plantillas',  path: '/app/m/atlas.website/templates', icon: 'LayoutTemplate', layout: 'main', permissionKey: 'website.pages.create' },
  ```

- [ ] **Step 3: Verificar sintaxis**

  ```bash
  node --check apps/desktop/src/app/ModuleOutlet.jsx
  node --check apps/api/src/manifests/official/feature-modules.js
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add apps/desktop/src/app/ModuleOutlet.jsx \
          apps/api/src/manifests/official/feature-modules.js
  git commit -m "feat(website): register WebsiteTemplatesScreen in ModuleOutlet and add nav entry"
  ```

---

## Task 7 — Endpoint GET /public/website/auth-check

**Files:**
- Modify: `apps/api/src/routes/public-website.js`

- [ ] **Step 1: Añadir el endpoint al router**

  Al final de la función `createPublicWebsiteRouter`, antes del `return app`, añadir:

  ```js
  app.get('/auth-check', async (c) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return c.json({ error: 'Token requerido' }, 401)

    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token)
      if (error || !data?.user) return c.json({ error: 'Token invalido o expirado' }, 401)

      const authUserId = data.user.id
      const profile = await prisma.userProfile.findUnique({ where: { authUserId } })
      if (!profile) return c.json({ canAccessErp: false })

      const memberships = await prisma.membership.findMany({
        where: { userId: profile.id, enabled: true },
        include: {
          role: {
            include: {
              permissions: {
                where: { permission: { active: true } },
                include: { permission: { select: { key: true } } },
              },
            },
          },
        },
      })

      const hasErpAccess = memberships.some((m) =>
        m.role?.permissions?.some((rp) =>
          rp.permission?.key?.startsWith('atlas.') || rp.permission?.key?.startsWith('website.') ||
          rp.permission?.key?.startsWith('contacts.') || rp.permission?.key?.startsWith('hr.') ||
          rp.permission?.key?.startsWith('finance.')
        )
      )

      return c.json({ canAccessErp: hasErpAccess })
    } catch (err) {
      console.error('[public/website/auth-check]', err?.message)
      return c.json({ error: 'Error interno' }, 500)
    }
  })
  ```

  **NOTA:** `supabaseAdmin` ya está importado en el archivo `apps/api/src/index.js` pero el router de public-website recibe `{ prisma }`. Necesita acceder a `supabaseAdmin`. Hay dos opciones:
  
  **Opción A (recomendada):** Pasar `supabaseAdmin` como parámetro al factory `createPublicWebsiteRouter({ prisma, supabaseAdmin })`.

  **Opción B:** Importar `supabaseAdmin` directamente si está exported desde donde se crea.

  Verifica cómo se crea `supabaseAdmin` en `apps/api/src/index.js`:
  ```bash
  grep -n "supabaseAdmin\|createClient" apps/api/src/index.js | head -10
  ```

  Si `supabaseAdmin` se crea localmente en `index.js` (no exportado), usa **Opción A** — modifica la llamada a `createPublicWebsiteRouter` en `index.js` para pasar `supabaseAdmin`.

- [ ] **Step 2: Actualizar la firma del factory y su llamada en index.js**

  En `apps/api/src/routes/public-website.js`, cambiar:
  ```js
  export function createPublicWebsiteRouter({ prisma }) {
  ```
  Por:
  ```js
  export function createPublicWebsiteRouter({ prisma, supabaseAdmin }) {
  ```

  En `apps/api/src/index.js`, busca la línea que monta `publicWebsiteRouter` y añade `supabaseAdmin`:
  ```js
  const publicWebsiteRouter = createPublicWebsiteRouter({ prisma, supabaseAdmin })
  ```

- [ ] **Step 3: Verificar sintaxis**

  ```bash
  node --check apps/api/src/routes/public-website.js
  node --check apps/api/src/index.js
  ```

- [ ] **Step 4: Test del endpoint**

  Con la API corriendo (`pnpm dev:api`):
  ```bash
  # Sin token → 401
  curl http://localhost:4010/public/website/auth-check
  # Expected: {"error":"Token requerido"}

  # Con token inválido → 401
  curl -H "Authorization: Bearer invalid-token" http://localhost:4010/public/website/auth-check
  # Expected: {"error":"Token invalido o expirado"}
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/routes/public-website.js apps/api/src/index.js
  git commit -m "feat(website): add GET /public/website/auth-check endpoint"
  ```

---

## Task 8 — Crear PublicClientLogin.jsx

**Files:**
- Create: `apps/desktop/src/shell/PublicClientLogin.jsx`

- [ ] **Step 1: Crear el componente**

  ```jsx
  // apps/desktop/src/shell/PublicClientLogin.jsx
  import { useState, useEffect } from 'react'
  import { useNavigate, Link } from 'react-router-dom'
  import { supabase } from '../lib/supabase.js'
  import { getApiUrl } from '../lib/runtimeConfig.js'
  import { useQuery } from '@tanstack/react-query'

  function useSiteName() {
    return useQuery({
      queryKey: ['public-website-resolve-login'],
      queryFn: async () => {
        const res = await fetch(`${getApiUrl()}/public/website/resolve?path=/`)
        if (!res.ok) return null
        return res.json()
      },
      staleTime: 300_000,
      retry: 1,
    })
  }

  export function PublicClientLogin() {
    const navigate = useNavigate()
    const [email, setEmail]       = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading]   = useState(false)
    const [error, setError]       = useState(null)

    const siteQuery = useSiteName()
    const siteName = siteQuery.data?.site?.name ?? null

    // If already logged in, redirect immediately
    useEffect(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.access_token) {
          checkRoleAndRedirect(data.session.access_token)
        }
      })
    }, []) // eslint-disable-line

    async function checkRoleAndRedirect(token) {
      try {
        const res = await fetch(`${getApiUrl()}/public/website/auth-check`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        navigate(data.canAccessErp ? '/app' : '/', { replace: true })
      } catch {
        navigate('/', { replace: true })
      }
    }

    async function handleSubmit(e) {
      e.preventDefault()
      setError(null)
      setLoading(true)
      try {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          if (signInError.message?.toLowerCase().includes('invalid') || signInError.status === 400) {
            setError('Correo o contrasena incorrectos. Verifica tus datos.')
          } else {
            setError('Ocurrio un error. Intenta de nuevo.')
          }
          return
        }
        await checkRoleAndRedirect(data.session.access_token)
      } catch {
        setError('Ocurrio un error inesperado. Intenta de nuevo.')
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[hsl(var(--background))] px-6">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo/site name */}
          <div className="text-center space-y-2">
            {siteName && (
              <p className="text-2xl font-bold text-[hsl(var(--foreground))] tracking-tight">
                {siteName}
              </p>
            )}
            <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
              Iniciar sesion
            </h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Accede a tu cuenta para continuar.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[hsl(var(--foreground))]">
                Correo electronico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[hsl(var(--foreground))]">
                Contrasena
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Ingresando...' : 'Entrar'}
            </button>
          </form>

          <div className="text-center">
            <Link
              to="/"
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              &larr; Volver al sitio
            </Link>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verificar sintaxis**

  ```bash
  node --check apps/desktop/src/shell/PublicClientLogin.jsx
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/shell/PublicClientLogin.jsx
  git commit -m "feat(website): add PublicClientLogin component with role-based redirect"
  ```

---

## Task 9 — Añadir ruta /acceso en main.jsx

**Files:**
- Modify: `apps/desktop/src/main.jsx`

- [ ] **Step 1: Añadir import**

  Después de `import { PublicWebsiteEntry } from "./shell/PublicWebsiteEntry.jsx";`, añadir:
  ```js
  import { PublicClientLogin } from "./shell/PublicClientLogin.jsx";
  ```

- [ ] **Step 2: Añadir la ruta**

  Dentro del componente `App`, en el `<Routes>`, después de `<Route path="/login" element={<LoginRouteGuard />} />` (línea ~181), añadir:
  ```jsx
  <Route path="/acceso" element={<PublicClientLogin />} />
  ```

- [ ] **Step 3: Verificar sintaxis**

  ```bash
  node --check apps/desktop/src/main.jsx
  ```

- [ ] **Step 4: Smoke test**

  ```bash
  pnpm dev:frontend
  ```
  - Navegar a `http://localhost:5173/acceso` → debe mostrar la pantalla de login de cliente (sin AppShell)
  - Navegar a `http://localhost:5173/login` → debe seguir mostrando el login del ERP (sin cambios)

- [ ] **Step 5: Commit**

  ```bash
  git add apps/desktop/src/main.jsx
  git commit -m "feat(website): add /acceso route for public client login"
  ```

---

## Self-Review

**Spec coverage check:**
- [x] Templates multi-página: Tasks 1–10 en Plan A
- [x] 12 templates (6 migrados + 6 nuevos): Plan A Tasks 1–9
- [x] Picker 2 pasos + categorías: Task 1 (TemplatePickerModal)
- [x] Picker abre desde editor GrapesJS: Task 2 (WebsiteGrapesEditor)
- [x] Picker abre desde pantalla de páginas vacía: Task 4 (WebsitePagesScreen)
- [x] Pantalla "Plantillas" en admin: Task 5 (WebsiteTemplatesScreen)
- [x] Picker abre desde pantalla Plantillas en paso 2: Task 5 Step 2 (initialTemplate prop)
- [x] Nav entry "Plantillas" en manifest: Task 6
- [x] Login de clientes `/acceso`: Tasks 7–9
- [x] Redirect inteligente por rol: Task 8 (`checkRoleAndRedirect`) + Task 7 (`auth-check`)
- [x] Login link en templates navbar: Plan A (cada template incluye `href="/acceso"`)

**Placeholder scan:** Sin TBD ni TODO en código.

**Type consistency:**
- `TemplatePickerModal` props: `{ isOpen, onClose, token, siteId, onHomePageApplied, initialTemplate }` — usados consistentemente en Tasks 1, 4, 5
- `handleHomePageApplied({ html, css })` en WebsiteGrapesEditor (Task 2) matches `onHomePageApplied({ html, css })` called in TemplatePickerModal (Task 1)
- `createPublicWebsiteRouter({ prisma, supabaseAdmin })` — actualizado en Tasks 7

---

## Verification Final Plan B

```bash
# Sintaxis
node --check apps/desktop/src/website/TemplatePickerModal.jsx
node --check apps/desktop/src/website/WebsiteGrapesEditor.jsx
node --check apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx
node --check apps/desktop/src/modules/atlas.website/screens/WebsitePagesScreen.jsx
node --check apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx
node --check apps/desktop/src/app/ModuleOutlet.jsx
node --check apps/desktop/src/shell/PublicClientLogin.jsx
node --check apps/desktop/src/main.jsx
node --check apps/api/src/routes/public-website.js
node --check apps/api/src/manifests/official/feature-modules.js

# API endpoint
curl http://localhost:4010/public/website/auth-check
# Expected: {"error":"Token requerido"}

# Frontend routes
# http://localhost:5173/acceso → PublicClientLogin (sin AppShell)
# http://localhost:5173/app/m/atlas.website/templates → WebsiteTemplatesScreen
# http://localhost:5173/app/m/atlas.website/pages → "Empezar desde plantilla" visible cuando no hay pages
```
