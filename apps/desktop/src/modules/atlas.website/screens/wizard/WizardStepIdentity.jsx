// apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepIdentity.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { extractColorsFromFile, extractColorsFromBlobUrl, PRESET_COLORS } from '../../lib/colorExtract.js'

const FONTS = [
  { value: 'Inter',            label: 'Inter',            family: 'Inter, sans-serif' },
  { value: 'Playfair Display', label: 'Playfair Display', family: "'Playfair Display', serif" },
  { value: 'Space Grotesk',    label: 'Space Grotesk',    family: "'Space Grotesk', sans-serif" },
  { value: 'DM Sans',          label: 'DM Sans',          family: "'DM Sans', sans-serif" },
  { value: 'Merriweather',     label: 'Merriweather',     family: "'Merriweather', serif" },
]

const FIVE_MB = 5 * 1024 * 1024

function LogoZone({ logoFile, logoPreviewUrl, companyLogoUrl, useCompanyLogo, onFile, onUseCompany, onRemove }) {
  const [isDragging, setIsDragging] = useState(false)
  const [sizeError, setSizeError]   = useState('')
  const inputRef = useRef(null)

  const handleFile = useCallback((file) => {
    setSizeError('')
    if (!file) return
    if (file.size > FIVE_MB) { setSizeError('Archivo demasiado grande. Maximo 5 MB'); return }
    onFile(file)
  }, [onFile])

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files?.[0] ?? null)
  }

  const displayUrl = logoPreviewUrl ?? (useCompanyLogo ? companyLogoUrl : null)

  if (displayUrl) {
    return (
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-xl border-2 border-border bg-card flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
          <img src={displayUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1"/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {logoFile ? logoFile.name : 'Logo de la empresa'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : 'Se usara como logo del sitio'}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              Cambiar logo
            </button>
            <span className="text-muted-foreground">|</span>
            <button type="button" onClick={onRemove}
              className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors">
              Quitar
            </button>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="sr-only"/>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {companyLogoUrl && (
        <button type="button" onClick={onUseCompany}
          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all text-left">
          <div className="w-10 h-10 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
            <img src={companyLogoUrl} alt="Logo empresa" className="max-w-full max-h-full object-contain p-0.5"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">Usar logo de la empresa</p>
            <p className="text-xs text-muted-foreground">El mismo logo configurado en Empresa</p>
          </div>
        </button>
      )}
      <div
        role="button" tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 px-4 text-center cursor-pointer transition-all select-none ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
        }`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDragging ? 'bg-primary/10' : 'bg-muted'}`}>
          <svg viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}>
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4-4 4M12 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Subir logo propio</p>
          <p className="text-xs text-muted-foreground">PNG, SVG o WebP · Max 5 MB</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="sr-only"/>
      </div>
      {sizeError && <p className="text-xs text-destructive">{sizeError}</p>}
    </div>
  )
}

export function WizardStepIdentity({ defaultValues, companyLogoUrl, onNext, onBack }) {
  const [identity, setIdentity] = useState(defaultValues ?? {
    primaryColor: '#4F46E5',
    bgColor: '#FFFFFF',
    font: 'Inter',
  })
  const [logoFile,        setLogoFile]        = useState(null)
  const [logoPreviewUrl,  setLogoPreviewUrl]  = useState(null)
  const [useCompanyLogo,  setUseCompanyLogo]  = useState(false)
  const [suggestedColors, setSuggestedColors] = useState(PRESET_COLORS)

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null)
      if (!useCompanyLogo) setSuggestedColors(PRESET_COLORS)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreviewUrl(url)
    extractColorsFromFile(logoFile).then((colors) => {
      setSuggestedColors(colors.length >= 3 ? colors : PRESET_COLORS)
    })
    return () => URL.revokeObjectURL(url)
  }, [logoFile]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!useCompanyLogo || !companyLogoUrl) return
    extractColorsFromBlobUrl(companyLogoUrl).then((colors) => {
      if (colors.length >= 3) setSuggestedColors(colors)
    })
  }, [useCompanyLogo, companyLogoUrl])

  function handleSubmit() {
    onNext({ ...identity, logoFile, useCompanyLogo })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">Logo del sitio</label>
        <LogoZone
          logoFile={logoFile}
          logoPreviewUrl={logoPreviewUrl}
          companyLogoUrl={companyLogoUrl}
          useCompanyLogo={useCompanyLogo}
          onFile={(f) => { setUseCompanyLogo(false); setLogoFile(f) }}
          onUseCompany={() => { setLogoFile(null); setLogoPreviewUrl(null); setUseCompanyLogo(true) }}
          onRemove={() => { setLogoFile(null); setLogoPreviewUrl(null); setUseCompanyLogo(false); setSuggestedColors(PRESET_COLORS) }}
        />
      </div>

      <hr className="border-border"/>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">Color primario</label>
          <div className="flex items-center gap-2.5 border-2 border-border rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all bg-background">
            <div className="relative">
              <input type="color" value={identity.primaryColor}
                onChange={(e) => setIdentity((i) => ({ ...i, primaryColor: e.target.value }))}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
              <div className="w-8 h-8 rounded-lg shadow-sm border border-border/50" style={{ background: identity.primaryColor }}/>
            </div>
            <input type="text" value={identity.primaryColor}
              onChange={(e) => setIdentity((i) => ({ ...i, primaryColor: e.target.value }))}
              className="flex-1 text-sm font-mono text-foreground outline-none bg-transparent"/>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">Color de fondo</label>
          <div className="flex items-center gap-2.5 border-2 border-border rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all bg-background">
            <div className="relative">
              <input type="color" value={identity.bgColor}
                onChange={(e) => setIdentity((i) => ({ ...i, bgColor: e.target.value }))}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
              <div className="w-8 h-8 rounded-lg shadow-sm border border-border" style={{ background: identity.bgColor }}/>
            </div>
            <input type="text" value={identity.bgColor}
              onChange={(e) => setIdentity((i) => ({ ...i, bgColor: e.target.value }))}
              className="flex-1 text-sm font-mono text-foreground outline-none bg-transparent"/>
          </div>
        </div>
      </div>

      {suggestedColors !== PRESET_COLORS && suggestedColors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Colores extraidos del logo</p>
          <div className="flex gap-2 flex-wrap">
            {suggestedColors.map((color) => (
              <button key={color} type="button" onClick={() => setIdentity((i) => ({ ...i, primaryColor: color }))}
                aria-label={`Usar ${color}`}
                className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 active:scale-95 ${
                  identity.primaryColor === color ? 'border-foreground scale-110 ring-2 ring-foreground/20' : 'border-border hover:border-foreground/40'
                }`}
                style={{ background: color }}/>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Colores predefinidos</p>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button key={color} type="button" onClick={() => setIdentity((i) => ({ ...i, primaryColor: color }))}
              aria-label={`Usar ${color}`}
              className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 active:scale-95 ${
                identity.primaryColor === color ? 'border-foreground scale-110 ring-2 ring-foreground/20' : 'border-border hover:border-foreground/40'
              }`}
              style={{ background: color }}/>
          ))}
        </div>
      </div>

      <div className="h-8 rounded-xl border border-border transition-all duration-300"
        style={{ background: `linear-gradient(90deg, ${identity.primaryColor} 0%, ${identity.primaryColor}bb 40%, ${identity.bgColor} 100%)` }}/>

      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">Tipografia</label>
        <div className="grid grid-cols-5 gap-2">
          {FONTS.map((f) => (
            <button key={f.value} type="button"
              onClick={() => setIdentity((i) => ({ ...i, font: f.value }))}
              className={`rounded-xl border-2 p-3 text-center transition-all duration-150 ${
                identity.font === f.value
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-border/80 bg-card'
              }`}>
              <p className="text-lg font-semibold text-foreground leading-none" style={{ fontFamily: f.family }}>Aa</p>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight truncate">{f.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        {onBack && (
          <button type="button" onClick={onBack}
            className="flex-1 py-3 rounded-xl font-semibold text-sm text-foreground border-2 border-border hover:bg-muted transition-all">
            Atras
          </button>
        )}
        <button type="button" onClick={handleSubmit}
          className="flex-1 py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
          Siguiente
        </button>
      </div>
    </div>
  )
}
