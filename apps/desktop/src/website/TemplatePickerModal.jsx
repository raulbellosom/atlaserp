// apps/desktop/src/website/TemplatePickerModal.jsx
import { useState, useEffect } from 'react'
import { allTemplates } from './atlasTemplates/index.js'
import { getApiUrl } from '../lib/runtimeConfig.js'

const CATEGORY_LABELS = {
  all: 'Todos', hosteleria: 'Hosteleria', bienestar: 'Bienestar',
  tecnologia: 'Tecnologia', comercio: 'Comercio', negocios: 'Negocios',
  salud: 'Salud', creativo: 'Creativo', medios: 'Medios',
  educacion: 'Educacion', social: 'Social',
}

async function createOrUpdatePage({ token, siteId, page, existingPages }) {
  const apiUrl = getApiUrl()
  const existing = existingPages.find((p) => p.routePath === page.routePath)

  if (existing) {
    const res = await fetch(`${apiUrl}/website/pages/${existing.id}/save-draft`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ builderData: { html: page.html, css: page.css ?? '' } }),
    })
    if (!res.ok) throw new Error(`Error al actualizar pagina ${page.routePath}`)
    return existing
  }

  const slug = page.routePath === '/' ? 'home' : page.routePath.replace(/^\//, '').replace(/\//g, '-')
  const createRes = await fetch(`${apiUrl}/website/pages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteId, title: page.title, slug, routePath: page.routePath,
      pageType: 'page', visibility: 'public',
    }),
  })
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}))
    throw new Error(err.error || `Error al crear pagina ${page.routePath}`)
  }
  const created = await createRes.json()
  const draftRes = await fetch(`${apiUrl}/website/pages/${created.id}/save-draft`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ builderData: { html: page.html, css: page.css ?? '' } }),
  })
  if (!draftRes.ok) throw new Error(`Error al guardar borrador de ${page.routePath}`)
  return created
}

export function TemplatePickerModal({ isOpen, onClose, token, siteId, onHomePageApplied, initialTemplate = null }) {
  const [step, setStep] = useState(() => (initialTemplate ? 2 : 1))
  const [selected, setSelected] = useState(initialTemplate)
  const [enabledPages, setEnabledPages] = useState(() => {
    if (!initialTemplate) return {}
    return Object.fromEntries(initialTemplate.pages.map((p) => [p.id, true]))
  })
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [confirmReplace, setConfirmReplace] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setStep(initialTemplate ? 2 : 1)
    setSelected(initialTemplate ?? null)
    setEnabledPages(
      initialTemplate
        ? Object.fromEntries(initialTemplate.pages.map((p) => [p.id, true]))
        : {}
    )
    setConfirmReplace(false)
    setError(null)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  const categories = ['all', ...new Set(allTemplates.map((t) => t.category).filter(Boolean))]
  const filtered = categoryFilter === 'all' ? allTemplates : allTemplates.filter((t) => t.category === categoryFilter)

  function handleSelectTemplate(tpl) {
    setSelected(tpl)
    setEnabledPages(Object.fromEntries(tpl.pages.map((p) => [p.id, true])))
    setConfirmReplace(false)
    setError(null)
  }

  function togglePage(pageId, required) {
    if (required) return
    setEnabledPages((prev) => ({ ...prev, [pageId]: !prev[pageId] }))
  }

  function selectedPages() {
    return (selected?.pages ?? []).filter((p) => enabledPages[p.id])
  }

  function handleClose() {
    setStep(initialTemplate ? 2 : 1)
    setSelected(initialTemplate)
    setEnabledPages(initialTemplate ? Object.fromEntries(initialTemplate.pages.map((p) => [p.id, true])) : {})
    setConfirmReplace(false)
    setError(null)
    onClose()
  }

  async function handleApply() {
    if (!selected) return
    if (!confirmReplace) { setConfirmReplace(true); return }

    setApplying(true)
    setError(null)
    try {
      const pagesToApply = selectedPages()
      const homePage = pagesToApply.find((p) => p.routePath === '/') ?? pagesToApply[0]

      if (siteId && token) {
        const listRes = await fetch(`${getApiUrl()}/website/pages?siteId=${siteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const listData = listRes.ok ? await listRes.json() : { data: [] }
        const existingPages = listData.data ?? []
        for (const page of pagesToApply) {
          await createOrUpdatePage({ token, siteId, page, existingPages })
        }
      }

      if (homePage) onHomePageApplied({ html: homePage.html, css: homePage.css ?? '' })
      handleClose()
    } catch (err) {
      setError(err.message || 'Error al aplicar la plantilla')
    } finally {
      setApplying(false)
    }
  }

  const count = selectedPages().length

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth: step === 1 ? '960px' : '560px', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ padding:'22px 28px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <h2 style={{ margin:0, fontSize:'20px', fontWeight:800, color:'#0f172a', letterSpacing:'-0.01em' }}>
              {step === 1 ? 'Elegir plantilla' : `Paginas — ${selected?.label}`}
            </h2>
            <p style={{ margin:'3px 0 0', fontSize:'13px', color:'#64748b' }}>
              {step === 1 ? 'Selecciona una plantilla para tu sitio.' : 'Elige que paginas deseas crear.'}
            </p>
          </div>
          <button type="button" onClick={handleClose} style={{ background:'#f1f5f9', border:'none', borderRadius:'8px', width:'34px', height:'34px', cursor:'pointer', fontSize:'18px', color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center' }}>&times;</button>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <>
            <div style={{ padding:'14px 28px 0', display:'flex', gap:'8px', flexWrap:'wrap', flexShrink:0 }}>
              {categories.map((cat) => (
                <button type="button" key={cat} onClick={() => setCategoryFilter(cat)}
                  style={{ background: categoryFilter === cat ? '#0f172a' : '#f1f5f9', color: categoryFilter === cat ? 'white' : '#374151', border:'none', borderRadius:'999px', padding:'6px 14px', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
            <div style={{ overflowY:'auto', padding:'16px 28px', flex:1 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'14px' }}>
                {filtered.map((tpl) => (
                  <div key={tpl.id} role="button" tabIndex={0} onClick={() => handleSelectTemplate(tpl)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectTemplate(tpl) } }}
                    style={{ border: selected?.id === tpl.id ? `2px solid ${tpl.color}` : '2px solid #e2e8f0', borderRadius:'14px', cursor:'pointer', overflow:'hidden', transition:'border-color 0.15s', boxShadow: selected?.id === tpl.id ? `0 0 0 3px ${tpl.color}22` : 'none' }}>
                    <div style={{ height:'80px', background:`linear-gradient(135deg, ${tpl.color} 0%, ${tpl.color}bb 100%)`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                      <span style={{ fontSize:'26px', fontWeight:900, color:'rgba(255,255,255,0.2)', textTransform:'uppercase' }}>{tpl.label.charAt(0)}</span>
                      {tpl.category && (
                        <span style={{ position:'absolute', top:7, right:8, background:'rgba(0,0,0,0.22)', color:'white', fontSize:'10px', fontWeight:700, padding:'2px 7px', borderRadius:'999px', textTransform:'uppercase', letterSpacing:'0.05em' }}>{tpl.category}</span>
                      )}
                    </div>
                    <div style={{ padding:'12px 14px' }}>
                      <p style={{ margin:'0 0 3px', fontSize:'14px', fontWeight:700, color:'#0f172a' }}>{tpl.label}</p>
                      <p style={{ margin:'0 0 8px', fontSize:'12px', color:'#64748b', lineHeight:'1.4' }}>{tpl.description}</p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'3px' }}>
                        {(tpl.pages ?? []).map((p) => (
                          <span key={p.id} style={{ background:'#f1f5f9', color:'#475569', fontSize:'10px', fontWeight:600, padding:'2px 7px', borderRadius:'999px' }}>{p.label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding:'14px 28px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'flex-end', gap:'10px', flexShrink:0 }}>
              <button type="button" onClick={handleClose} style={{ background:'#f1f5f9', border:'none', color:'#374151', fontSize:'14px', fontWeight:600, padding:'9px 20px', borderRadius:'8px', cursor:'pointer' }}>Cancelar</button>
              <button type="button" onClick={() => { setStep(2); setConfirmReplace(false) }} disabled={!selected}
                style={{ background: !selected ? '#e2e8f0' : '#4f46e5', border:'none', color: !selected ? '#94a3b8' : 'white', fontSize:'14px', fontWeight:700, padding:'9px 22px', borderRadius:'8px', cursor: selected ? 'pointer' : 'not-allowed' }}>
                Siguiente &rarr;
              </button>
            </div>
          </>
        )}

        {/* Step 2 */}
        {step === 2 && selected && (
          <>
            <div style={{ overflowY:'auto', padding:'18px 28px', flex:1 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {selected.pages.map((page) => (
                  <div key={page.id} role="checkbox" aria-checked={enabledPages[page.id]} tabIndex={page.required ? -1 : 0}
                    onClick={() => togglePage(page.id, page.required)}
                    onKeyDown={(e) => { if (!page.required && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); togglePage(page.id, page.required) } }}
                    style={{ display:'flex', alignItems:'center', gap:'12px', padding:'13px 16px', borderRadius:'10px', border:`2px solid ${enabledPages[page.id] ? '#4f46e5' : '#e2e8f0'}`, background: enabledPages[page.id] ? '#f5f3ff' : 'white', cursor: page.required ? 'default' : 'pointer', transition:'all 0.12s' }}>
                    <div style={{ width:'18px', height:'18px', borderRadius:'4px', border:`2px solid ${enabledPages[page.id] ? '#4f46e5' : '#cbd5e1'}`, background: enabledPages[page.id] ? '#4f46e5' : 'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {enabledPages[page.id] && <span style={{ color:'white', fontSize:'11px', fontWeight:900, lineHeight:1 }}>&#10003;</span>}
                    </div>
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize:'14px', fontWeight:700, color:'#0f172a' }}>{page.label}</span>
                      <span style={{ fontSize:'12px', color:'#94a3b8', marginLeft:'8px', fontFamily:'monospace' }}>{page.routePath}</span>
                    </div>
                    {page.required && (
                      <span style={{ fontSize:'11px', fontWeight:700, color:'#6366f1', background:'#e0e7ff', padding:'2px 9px', borderRadius:'999px' }}>Requerida</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ margin:'0 28px 12px', padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', color:'#dc2626', fontSize:'13px' }}>
                {error}
              </div>
            )}

            <div style={{ padding:'14px 28px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexShrink:0 }}>
              {!initialTemplate ? (
                <button type="button" onClick={() => { setStep(1); setConfirmReplace(false); setError(null) }}
                  style={{ background:'#f1f5f9', border:'none', color:'#374151', fontSize:'14px', fontWeight:600, padding:'9px 20px', borderRadius:'8px', cursor:'pointer' }}>
                  &larr; Volver
                </button>
              ) : (
                <button type="button" onClick={handleClose}
                  style={{ background:'#f1f5f9', border:'none', color:'#374151', fontSize:'14px', fontWeight:600, padding:'9px 20px', borderRadius:'8px', cursor:'pointer' }}>
                  Cancelar
                </button>
              )}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'5px' }}>
                {confirmReplace && !applying && (
                  <p style={{ margin:0, fontSize:'12px', color:'#dc2626', fontWeight:600 }}>
                    Las paginas con rutas existentes seran reemplazadas.
                  </p>
                )}
                <button type="button" onClick={handleApply} disabled={applying || count === 0}
                  style={{ background: applying || count === 0 ? '#e2e8f0' : confirmReplace ? '#dc2626' : '#4f46e5', border:'none', color: applying || count === 0 ? '#94a3b8' : 'white', fontSize:'14px', fontWeight:700, padding:'9px 22px', borderRadius:'8px', cursor: applying || count === 0 ? 'not-allowed' : 'pointer' }}>
                  {applying ? 'Aplicando...' : confirmReplace ? `Confirmar y crear ${count} pagina${count !== 1 ? 's' : ''}` : `Crear ${count} pagina${count !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
