// modules/custom/custom.financia/components/ImportWizard.jsx
import { useState, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@atlas/ui'
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

const STEPS = ['Subir archivo', 'Mapear columnas', 'Previsualizar']

function fmtCurrency(amount, currency = 'MXN') {
  return Number(amount ?? 0).toLocaleString('es-MX', {
    style: 'currency', currency, minimumFractionDigits: 2,
  })
}

export default function ImportWizard() {
  // The route is a wildcard (*) — extract account ID from "accounts/UUID/import".
  const { "*": wildcard } = useParams()
  const accountId = useMemo(() => wildcard?.split('/')[1] ?? null, [wildcard])

  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const [step, setStep]       = useState(STEP_UPLOAD)
  const [rawRows, setRawRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState(null)
  const fileRef = useRef(null)

  // Load account details for the context header
  const { data: accountData } = useQuery({
    queryKey: ['financia-account', accountId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/financia/accounts/${accountId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudo cargar la cuenta.')
      return res.json()
    },
    enabled: !!accountId && !!token,
  })
  const account = accountData?.data ?? null

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

        const firstLine = lines[0].replace(/^﻿/, '') // Strip BOM
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

      {/* ── Account context header (matches AccountScreen layout) ──────── */}
      <div className="px-6 pt-5 pb-4 border-b border-[hsl(var(--border))] shrink-0">
        <button
          onClick={() => navigate(`/app/m/custom.financia/accounts/${accountId}`)}
          className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-1.5 transition-colors"
        >
          <ArrowLeft size={11} />
          {account ? account.name : 'Cuenta'}
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
          Importar movimientos
        </h1>
        {account && (
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            {account.bank}
            <span className="mx-1.5 opacity-40">·</span>
            {account.currency}
            <span className="mx-1.5 opacity-40">·</span>
            <span
              className="font-semibold tabular-nums"
              style={{ color: 'var(--module-accent, #16a34a)' }}
            >
              {fmtCurrency(account.current_balance, account.currency)}
            </span>
          </p>
        )}
      </div>

      {/* ── Step indicators ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[hsl(var(--border))] shrink-0">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={
                step >= i
                  ? { backgroundColor: 'var(--module-accent, #16a34a)', color: '#fff' }
                  : { border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }
              }
            >
              {step > i ? <Check size={12} /> : i + 1}
            </span>
            <span
              className={`text-sm whitespace-nowrap ${
                step === i
                  ? 'font-semibold text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))]'
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-[hsl(var(--muted-foreground))] mx-1">›</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-8">

        {/* Step 0: Upload */}
        {step === STEP_UPLOAD && (
          <div className="max-w-lg mx-auto">
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
              Sube un archivo CSV con tus movimientos bancarios. La primera fila debe contener los encabezados de columna.
            </p>
            <div
              className="border-2 border-dashed border-[hsl(var(--border))] rounded-2xl py-16 px-8 text-center cursor-pointer hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--muted))]/30 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
            >
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center">
                <Upload size={24} className="text-[hsl(var(--muted-foreground))]" />
              </div>
              <p className="text-base font-semibold text-[hsl(var(--foreground))]">Arrastra tu archivo aqui</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                o{' '}
                <span className="text-[hsl(var(--primary))] hover:underline">haz clic para seleccionar</span>
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3 px-4 py-1.5 rounded-full bg-[hsl(var(--muted))] inline-block">
                CSV — primera fila debe ser encabezados
              </p>
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
          <div className="max-w-lg mx-auto">
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
              Asocia las columnas de tu archivo con los campos del sistema.
              Se detectaron <strong>{rawRows.length}</strong> filas.
            </p>

            <div className="space-y-3">
              {TARGET_FIELDS.map(({ key, label, required }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-36 text-sm shrink-0 text-[hsl(var(--foreground))]">
                    {label}
                  </label>
                  <select
                    className={[
                      'flex-1 text-sm rounded-lg px-3 py-1.5 transition-colors',
                      'border border-[hsl(var(--border))] bg-[hsl(var(--background))]',
                      'text-[hsl(var(--foreground))]',
                      'focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]',
                      required && !mapping[key]
                        ? 'border-amber-400 dark:border-amber-600'
                        : '',
                    ].join(' ')}
                    value={mapping[key] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))
                    }
                  >
                    <option value="">— sin mapear —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="ghost" size="sm" onClick={() => setStep(STEP_UPLOAD)}>
                <ArrowLeft size={13} className="mr-1" />
                Atras
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => previewMutation.mutate()}
                disabled={!mapping.fecha || !mapping.nombre || previewMutation.isPending}
              >
                Previsualizar
                <ArrowRight size={13} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === STEP_PREVIEW && preview && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-sm font-semibold border border-emerald-200 dark:border-emerald-800">
                {preview.valid_count} filas validas
              </div>
              {preview.error_count > 0 && (
                <div className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm font-semibold border border-red-200 dark:border-red-800">
                  {preview.error_count} filas con error (seran ignoradas)
                </div>
              )}
            </div>

            {preview.errors?.length > 0 && (
              <div className="border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-xs font-semibold text-red-700 dark:text-red-300">
                  Errores detectados
                </div>
                <div className="max-h-40 overflow-auto divide-y divide-red-100 dark:divide-red-900">
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
              <div className="border border-[hsl(var(--border))] rounded-xl overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[hsl(var(--muted)/0.4)] border-b border-[hsl(var(--border))]">
                      <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                      <th className="px-3 py-2 text-left font-semibold">Nombre</th>
                      <th className="px-3 py-2 text-right font-semibold">Deposito</th>
                      <th className="px-3 py-2 text-right font-semibold">Retiro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-[hsl(var(--border)/0.5)] hover:bg-[hsl(var(--muted)/0.2)]">
                        <td className="px-3 py-1.5">{row.fecha}</td>
                        <td className="px-3 py-1.5 truncate max-w-50">{row.nombre}</td>
                        <td className="px-3 py-1.5 text-right text-emerald-700 dark:text-emerald-400 font-mono">{row.deposito ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right text-red-600 dark:text-red-400 font-mono">{row.retiro ?? '—'}</td>
                      </tr>
                    ))}
                    {preview.valid.length > 20 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-center text-[hsl(var(--muted-foreground))] text-xs">
                          ... y {preview.valid.length - 20} mas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(STEP_MAPPING)}>
                <ArrowLeft size={13} className="mr-1" />
                Atras
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => commitMutation.mutate()}
                disabled={preview.valid_count === 0 || commitMutation.isPending}
              >
                <Check size={13} className="mr-1" />
                Importar {preview.valid_count} movimientos
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
