// modules/custom/custom.financia/components/ImportWizard.jsx
import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, PageHeader } from '@atlas/ui'
import { Upload, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useAuth } from '../../../../apps/desktop/src/auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

// Fields the user can map to
const TARGET_FIELDS = [
  { key: 'fecha',      label: 'Fecha *',    required: true  },
  { key: 'nombre',     label: 'Nombre *',   required: true  },
  { key: 'deposito',   label: 'Deposito',   required: false },
  { key: 'retiro',     label: 'Retiro',     required: false },
  { key: 'numero',     label: 'Numero',     required: false },
  { key: 'referencia', label: 'Referencia', required: false },
  { key: 'concepto',   label: 'Concepto',   required: false },
]

const STEP_UPLOAD  = 0
const STEP_MAPPING = 1
const STEP_PREVIEW = 2

export default function ImportWizard() {
  const { id: accountId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const [step, setStep]       = useState(STEP_UPLOAD)
  const [rawRows, setRawRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState(null)
  const fileRef = useRef(null)

  // ── Step 1: Upload ────────────────────────────────────────────────────────────

  function handleFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx'].includes(ext)) {
      toast.error('Solo se aceptan archivos CSV o XLSX.')
      return
    }

    if (ext === 'xlsx') {
      toast.error('Por ahora use CSV. Soporte XLSX disponible via importacion en el servidor.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const lines = text.split(/\r?\n/).filter(Boolean)
        if (lines.length < 2) { toast.error('El archivo no tiene datos.'); return }

        const parsecsv = (line) => {
          const result = []; let cur = ''; let inQ = false
          for (const ch of line) {
            if (ch === '"') { inQ = !inQ }
            else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
            else cur += ch
          }
          result.push(cur.trim())
          return result
        }

        // Strip BOM
        const firstLine = lines[0].replace(/^﻿/, '')
        const hdrs = parsecsv(firstLine)
        setHeaders(hdrs)

        const rows = lines.slice(1).map((line) => {
          const vals = parsecsv(line)
          return Object.fromEntries(hdrs.map((h, i) => [h, vals[i] ?? '']))
        })
        setRawRows(rows)

        // Auto-map by header similarity
        const autoMap = {}
        TARGET_FIELDS.forEach(({ key }) => {
          const match = hdrs.find((h) => {
            const lower = h.toLowerCase()
            if (key === 'fecha')      return lower.includes('fecha')
            if (key === 'nombre')     return lower.includes('nombre') || lower.includes('descripci')
            if (key === 'deposito')   return lower.includes('dep') || lower.includes('abono')
            if (key === 'retiro')     return lower.includes('ret') || lower.includes('cargo') || lower.includes('egreso')
            if (key === 'numero')     return lower.includes('num') || lower.includes('folio')
            if (key === 'referencia') return lower.includes('ref')
            if (key === 'concepto')   return lower.includes('concepto') || lower.includes('nota')
            return lower.includes(key)
          })
          if (match) autoMap[key] = match
        })
        setMapping(autoMap)
        setStep(STEP_MAPPING)
      } catch {
        toast.error('No se pudo leer el archivo.')
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  // ── Step 2: Preview mutation ──────────────────────────────────────────────────

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${API_BASE}/financia/accounts/${accountId}/import/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ rows: rawRows, mapping }),
        },
      )
      if (!res.ok) throw new Error('Error al previsualizar.')
      return res.json()
    },
    onSuccess: (data) => { setPreview(data); setStep(STEP_PREVIEW) },
    onError: (err) => toast.error(err.message),
  })

  // ── Step 3: Commit mutation ───────────────────────────────────────────────────

  const commitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${API_BASE}/financia/accounts/${accountId}/import/commit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ rows: rawRows, mapping }),
        },
      )
      if (!res.ok) throw new Error('Error al importar.')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`${data.inserted} movimientos importados.`)
      navigate(`/app/m/custom.financia/accounts/${accountId}`)
    },
    onError: (err) => toast.error(err.message),
  })

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Importar movimientos"
        breadcrumb={[
          { label: 'Cuentas', href: '/app/m/custom.financia/accounts' },
          { label: 'Importar' },
        ]}
      />

      {/* Step indicators */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[hsl(var(--border))]">
        {['Subir archivo', 'Mapear columnas', 'Previsualizar'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                step >= i ? 'text-white' : 'text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]'
              }`}
              style={step >= i ? { backgroundColor: 'var(--module-accent, #2563EB)' } : {}}
            >
              {step > i ? <Check size={12} /> : i + 1}
            </span>
            <span className={`text-sm ${step === i ? 'font-semibold' : 'text-[hsl(var(--muted-foreground))]'}`}>
              {label}
            </span>
            {i < 2 && <span className="text-[hsl(var(--muted-foreground))]">›</span>}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">

        {/* Step 0: Upload */}
        {step === STEP_UPLOAD && (
          <div className="max-w-md mx-auto">
            <div
              className="border-2 border-dashed border-[hsl(var(--border))] rounded-xl p-12 text-center cursor-pointer hover:border-[hsl(var(--ring))] transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
            >
              <Upload size={32} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm font-semibold">Arrastra tu archivo aqui</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">o haz clic para seleccionar</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">CSV — primera fila debe ser encabezados</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* Step 1: Mapping */}
        {step === STEP_MAPPING && (
          <div className="max-w-lg mx-auto space-y-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Asocia las columnas de tu archivo con los campos del sistema.
              Se detectaron {rawRows.length} filas.
            </p>
            {TARGET_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="w-32 text-sm shrink-0">{label}</label>
                <select
                  className="flex-1 text-sm border border-[hsl(var(--border))] rounded-md px-2 py-1.5 bg-[hsl(var(--background))]"
                  value={mapping[key] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))}
                >
                  <option value="">— sin mapear —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(STEP_UPLOAD)}>
                <ArrowLeft size={14} className="mr-1" /> Atras
              </Button>
              <Button
                variant="primary"
                onClick={() => previewMutation.mutate()}
                disabled={!mapping.fecha || !mapping.nombre || previewMutation.isPending}
              >
                Previsualizar <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === STEP_PREVIEW && preview && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="px-4 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-semibold">
                {preview.valid_count} filas validas
              </div>
              {preview.error_count > 0 && (
                <div className="px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold">
                  {preview.error_count} filas con error (seran ignoradas)
                </div>
              )}
            </div>

            {preview.errors?.length > 0 && (
              <div className="border border-red-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-red-50 text-xs font-semibold text-red-700">
                  Errores detectados
                </div>
                <div className="max-h-40 overflow-auto divide-y divide-red-100">
                  {preview.errors.map((e) => (
                    <div key={e.rowIndex} className="px-3 py-2 text-xs">
                      <span className="font-semibold">Fila {e.rowIndex}:</span>{' '}
                      {e.errors.join(', ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.valid?.length > 0 && (
              <div className="border border-[hsl(var(--border))] rounded-lg overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[hsl(var(--muted)/0.3)]">
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Nombre</th>
                      <th className="px-3 py-2 text-right">Deposito</th>
                      <th className="px-3 py-2 text-right">Retiro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-[hsl(var(--border)/0.5)]">
                        <td className="px-3 py-1.5">{row.fecha}</td>
                        <td className="px-3 py-1.5 truncate max-w-[200px]">{row.nombre}</td>
                        <td className="px-3 py-1.5 text-right text-green-700">{row.deposito ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right text-red-700">{row.retiro ?? '—'}</td>
                      </tr>
                    ))}
                    {preview.valid.length > 20 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-center text-[hsl(var(--muted-foreground))]">
                          ... y {preview.valid.length - 20} mas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(STEP_MAPPING)}>
                <ArrowLeft size={14} className="mr-1" /> Atras
              </Button>
              <Button
                variant="primary"
                onClick={() => commitMutation.mutate()}
                disabled={preview.valid_count === 0 || commitMutation.isPending}
              >
                <Check size={14} className="mr-1" />
                Importar {preview.valid_count} movimientos
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
