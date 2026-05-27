// modules/custom/custom.financia/components/SpreadsheetRegister.jsx
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@atlas/ui'
import { useAuth } from '../../../../apps/desktop/src/auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

// Editable columns in tab order (excludes # and Saldo which are read-only)
const EDITABLE_COLS = ['fecha', 'tipo_id', 'numero', 'nombre', 'referencia', 'concepto', 'deposito', 'retiro', 'category_id']

function fmtDecimal(val) {
  if (val == null || val === '') return ''
  const n = Number(val)
  return Number.isFinite(n) ? n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
}

// PostgreSQL date columns arrive as ISO timestamps ("2026-05-27T00:00:00.000Z").
// Slice to YYYY-MM-DD for <input type="date"> and API payloads.
function toDateValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function emptyRow(accountId) {
  return {
    _isNew: true,
    _dirty: false,
    id: null,
    account_id: accountId,
    fecha: new Date().toISOString().slice(0, 10),
    tipo_id: null,
    numero: '',
    nombre: '',
    referencia: '',
    concepto: '',
    deposito: '',
    retiro: '',
    category_id: null,
  }
}

export default function SpreadsheetRegister({ accountId, dateFrom, dateTo, types = [], categories = [] }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const queryClient = useQueryClient()
  const [editingRows, setEditingRows] = useState({}) // rowId/index -> draft values
  const [newRow, setNewRow] = useState(null)
  const tableRef = useRef(null)

  const queryKey = ['financia-transactions', accountId, dateFrom, dateTo]

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: 500 })
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo)   params.set('to', dateTo)
      const res = await fetch(
        `${API_BASE}/financia/accounts/${accountId}/transactions?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error('No se pudieron cargar los movimientos.')
      return res.json()
    },
    enabled: !!accountId && !!token,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ isNew, id, payload }) => {
      const url = isNew
        ? `${API_BASE}/financia/accounts/${accountId}/transactions`
        : `${API_BASE}/financia/accounts/${accountId}/transactions/${id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Error al guardar.')
      }
      return res.json()
    },
    // Optimistic update: show changes immediately in the UI while the
    // request is in flight. The balance column and consecutive # will be
    // corrected when the background refetch completes.
    onMutate: async ({ isNew, id, payload }) => {
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.data) return old
        if (isNew) {
          const tempRow = {
            ...payload,
            id: `__temp_${Date.now()}`,
            account_id: accountId,
            _pending: true,
            consecutive: '?',
            saldo_actual: null,
          }
          return { ...old, data: [...old.data, tempRow] }
        }
        return {
          ...old,
          data: old.data.map((r) =>
            r.id === id ? { ...r, ...payload, _pending: true } : r,
          ),
        }
      })
      return { previousData }
    },
    onError: (err, _vars, context) => {
      if (context?.previousData) queryClient.setQueryData(queryKey, context.previousData)
      toast.error(err.message)
    },
    onSettled: () => {
      // Always refetch so balances, consecutive numbers, and account header are correct
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['financia-account', accountId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (txId) => {
      const res = await fetch(
        `${API_BASE}/financia/accounts/${accountId}/transactions/${txId}/enabled`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ enabled: false }),
        },
      )
      if (!res.ok) throw new Error('No se pudo eliminar el movimiento.')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['financia-account', accountId] })
    },
    onError: (err) => { toast.error(err.message) },
  })

  // ── Row edit helpers ──────────────────────────────────────────────────────────

  function getDraft(row, rowIdx) {
    const key = row.id ?? `new-${rowIdx}`
    return editingRows[key] ?? row
  }

  function setDraft(row, rowIdx, field, value) {
    const key = row.id ?? `new-${rowIdx}`
    setEditingRows((prev) => ({ ...prev, [key]: { ...(prev[key] ?? row), [field]: value, _dirty: true } }))
  }

  function clearDraft(row, rowIdx) {
    const key = row.id ?? `new-${rowIdx}`
    setEditingRows((prev) => { const next = { ...prev }; delete next[key]; return next })
  }

  function saveRow(row, rowIdx) {
    const draft = getDraft(row, rowIdx)
    if (!draft._dirty && !draft._isNew) return

    const deposito = draft.deposito !== '' && draft.deposito != null ? Number(draft.deposito) : null
    const retiro   = draft.retiro   !== '' && draft.retiro   != null ? Number(draft.retiro)   : null

    if (!draft.nombre?.trim()) { toast.error('El campo Nombre es obligatorio.'); return }
    if (!deposito && !retiro)  { toast.error('Se requiere deposito o retiro mayor a cero.'); return }

    const payload = {
      fecha:       toDateValue(draft.fecha),
      tipo_id:     draft.tipo_id    || null,
      numero:      draft.numero     || null,
      nombre:      draft.nombre.trim(),
      referencia:  draft.referencia || null,
      concepto:    draft.concepto   || null,
      deposito,
      retiro,
      category_id: draft.category_id || null,
    }

    saveMutation.mutate({ isNew: !!draft._isNew, id: row.id, payload })
    clearDraft(row, rowIdx)
    if (draft._isNew) setNewRow(null)
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────────

  function handleKeyDown(e, row, rowIdx, colName) {
    const rows = data?.data ?? []

    if (e.key === 'Escape') {
      e.preventDefault()
      clearDraft(row, rowIdx)
    }

    if (e.key === 'Enter' || (e.ctrlKey && e.key === 'Enter')) {
      e.preventDefault()
      saveRow(row, rowIdx)
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const direction = e.key === 'ArrowUp' ? -1 : 1
      const nextIdx = rowIdx + direction
      if (nextIdx < 0 || nextIdx >= rows.length) return
      const colIdx = EDITABLE_COLS.indexOf(colName)
      const selector = `[data-row="${nextIdx}"][data-col="${EDITABLE_COLS[colIdx]}"]`
      tableRef.current?.querySelector(selector)?.focus()
    }
  }

  // ── Row blur — save on leaving entire row ─────────────────────────────────────

  function handleRowBlur(e, row, rowIdx) {
    const nextFocused = e.relatedTarget
    const rowEl = e.currentTarget
    if (rowEl.contains(nextFocused)) return
    saveRow(row, rowIdx)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const rows = data?.data ?? []

  const colClass = 'px-2 py-0 h-8 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] rounded w-full'
  const thClass  = 'px-2 py-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] text-left whitespace-nowrap border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] select-none'
  const tdClass  = 'border-b border-[hsl(var(--border)/0.5)] p-0 align-middle'

  if (isLoading) return (
    <div className="flex flex-col h-full">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
        <div className="h-3.5 w-24 rounded bg-[hsl(var(--muted))] animate-pulse" />
        <div className="h-7 w-20 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
      </div>
      {/* Spreadsheet skeleton */}
      <div className="flex-1 overflow-hidden">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[hsl(var(--muted)/0.3)]">
              {[16, 64, 56, 80, 72, 96, 112, 72, 72, 72, 64].map((w, i) => (
                <th key={i} className="px-2 py-1.5 border-b border-[hsl(var(--border))]">
                  <div className="h-3 rounded bg-[hsl(var(--muted))] animate-pulse" style={{ width: w }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }).map((_, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 1 ? 'bg-[hsl(var(--muted)/0.15)]' : ''}>
                {[16, 64, 56, 80, 72, 96, 112, 72, 72, 72, 64].map((w, colIdx) => (
                  <td key={colIdx} className="border-b border-[hsl(var(--border)/0.5)] px-2 py-1 align-middle">
                    <div
                      className="h-3 rounded bg-[hsl(var(--muted))] animate-pulse"
                      style={{ width: w }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
  if (isError)   return <div className="p-4 text-sm text-red-500">No se pudieron cargar los movimientos.</div>

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {rows.length} movimiento{rows.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setNewRow(emptyRow(accountId))}
          disabled={!!newRow}
        >
          <Plus size={13} className="mr-1" />
          Agregar
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table ref={tableRef} className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${thClass} w-10 text-center`}>#</th>
              <th className={`${thClass} w-28`}>Fecha</th>
              <th className={`${thClass} w-24`}>Tipo</th>
              <th className={`${thClass} w-24`}>Numero</th>
              <th className={`${thClass} min-w-40`}>Nombre</th>
              <th className={`${thClass} w-32`}>Referencia</th>
              <th className={`${thClass} min-w-35`}>Concepto</th>
              <th className={`${thClass} w-28 text-right`}>Ingreso</th>
              <th className={`${thClass} w-28 text-right`}>Egreso</th>
              <th className={`${thClass} w-24`}>Categoria</th>
              <th className={`${thClass} w-28 text-right`}>Saldo</th>
              <th className={`${thClass} w-8`}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const draft = getDraft(row, rowIdx)
              return (
                <tr
                  key={row.id}
                  onBlur={(e) => handleRowBlur(e, row, rowIdx)}
                  className="hover:bg-[hsl(var(--muted)/0.2)]"
                >
                  {/* # */}
                  <td className={`${tdClass} text-center text-xs text-[hsl(var(--muted-foreground))]`}>
                    {row.consecutive}
                  </td>
                  {/* Fecha */}
                  <td className={tdClass}>
                    <input
                      type="date"
                      className={colClass}
                      data-row={rowIdx} data-col="fecha"
                      value={toDateValue(draft.fecha)}
                      onChange={(e) => setDraft(row, rowIdx, 'fecha', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row, rowIdx, 'fecha')}
                    />
                  </td>
                  {/* Tipo */}
                  <td className={tdClass}>
                    <select
                      className={colClass}
                      data-row={rowIdx} data-col="tipo_id"
                      value={draft.tipo_id ?? ''}
                      onChange={(e) => setDraft(row, rowIdx, 'tipo_id', e.target.value || null)}
                      onKeyDown={(e) => handleKeyDown(e, row, rowIdx, 'tipo_id')}
                    >
                      <option value="">—</option>
                      {types.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}
                    </select>
                  </td>
                  {/* Numero */}
                  <td className={tdClass}>
                    <input
                      type="text"
                      className={colClass}
                      data-row={rowIdx} data-col="numero"
                      value={draft.numero ?? ''}
                      onChange={(e) => setDraft(row, rowIdx, 'numero', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row, rowIdx, 'numero')}
                    />
                  </td>
                  {/* Nombre */}
                  <td className={tdClass}>
                    <input
                      type="text"
                      className={colClass}
                      data-row={rowIdx} data-col="nombre"
                      value={draft.nombre ?? ''}
                      onChange={(e) => setDraft(row, rowIdx, 'nombre', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row, rowIdx, 'nombre')}
                    />
                  </td>
                  {/* Referencia */}
                  <td className={tdClass}>
                    <input
                      type="text"
                      className={colClass}
                      data-row={rowIdx} data-col="referencia"
                      value={draft.referencia ?? ''}
                      onChange={(e) => setDraft(row, rowIdx, 'referencia', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row, rowIdx, 'referencia')}
                    />
                  </td>
                  {/* Concepto */}
                  <td className={tdClass}>
                    <input
                      type="text"
                      className={colClass}
                      data-row={rowIdx} data-col="concepto"
                      value={draft.concepto ?? ''}
                      onChange={(e) => setDraft(row, rowIdx, 'concepto', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row, rowIdx, 'concepto')}
                    />
                  </td>
                  {/* Deposito */}
                  <td className={tdClass}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${colClass} text-right`}
                      data-row={rowIdx} data-col="deposito"
                      value={draft.deposito ?? ''}
                      onChange={(e) => setDraft(row, rowIdx, 'deposito', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row, rowIdx, 'deposito')}
                    />
                  </td>
                  {/* Retiro */}
                  <td className={tdClass}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${colClass} text-right`}
                      data-row={rowIdx} data-col="retiro"
                      value={draft.retiro ?? ''}
                      onChange={(e) => setDraft(row, rowIdx, 'retiro', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row, rowIdx, 'retiro')}
                    />
                  </td>
                  {/* Categoria */}
                  <td className={tdClass}>
                    <select
                      className={colClass}
                      data-row={rowIdx} data-col="category_id"
                      value={draft.category_id ?? ''}
                      onChange={(e) => setDraft(row, rowIdx, 'category_id', e.target.value || null)}
                      onKeyDown={(e) => handleKeyDown(e, row, rowIdx, 'category_id')}
                    >
                      <option value="">—</option>
                      {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </td>
                  {/* Saldo — read-only */}
                  <td className={`${tdClass} text-right pr-3 text-xs font-mono font-semibold`}>
                    {fmtDecimal(row.saldo_actual)}
                  </td>
                  {/* Delete */}
                  <td className={`${tdClass} text-center`}>
                    <button
                      className="text-[hsl(var(--muted-foreground))] hover:text-red-500 text-xs px-1"
                      onClick={() => deleteMutation.mutate(row.id)}
                      title="Eliminar"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}

            {/* New row */}
            {newRow && (
              <tr
                onBlur={(e) => {
                  const nextFocused = e.relatedTarget
                  if (e.currentTarget.contains(nextFocused)) return
                  saveRow(newRow, rows.length)
                }}
                className="bg-[hsl(var(--muted)/0.3)]"
              >
                <td className={`${tdClass} text-center text-xs text-[hsl(var(--muted-foreground))]`}>*</td>
                <td className={tdClass}>
                  <input type="date" className={colClass} autoFocus
                    value={newRow.fecha}
                    onChange={(e) => setNewRow((r) => ({ ...r, fecha: e.target.value, _dirty: true }))}
                    onKeyDown={(e) => { if (e.key === 'Escape') setNewRow(null) }}
                  />
                </td>
                <td className={tdClass}>
                  <select className={colClass}
                    value={newRow.tipo_id ?? ''}
                    onChange={(e) => setNewRow((r) => ({ ...r, tipo_id: e.target.value || null, _dirty: true }))}
                  >
                    <option value="">—</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}
                  </select>
                </td>
                <td className={tdClass}>
                  <input type="text" className={colClass}
                    value={newRow.numero}
                    onChange={(e) => setNewRow((r) => ({ ...r, numero: e.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input type="text" className={colClass} placeholder="Nombre *"
                    value={newRow.nombre}
                    onChange={(e) => setNewRow((r) => ({ ...r, nombre: e.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input type="text" className={colClass}
                    value={newRow.referencia}
                    onChange={(e) => setNewRow((r) => ({ ...r, referencia: e.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input type="text" className={colClass}
                    value={newRow.concepto}
                    onChange={(e) => setNewRow((r) => ({ ...r, concepto: e.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input type="number" min="0" step="0.01" className={`${colClass} text-right`}
                    value={newRow.deposito}
                    onChange={(e) => setNewRow((r) => ({ ...r, deposito: e.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input type="number" min="0" step="0.01" className={`${colClass} text-right`}
                    value={newRow.retiro}
                    onChange={(e) => setNewRow((r) => ({ ...r, retiro: e.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <select className={colClass}
                    value={newRow.category_id ?? ''}
                    onChange={(e) => setNewRow((r) => ({ ...r, category_id: e.target.value || null, _dirty: true }))}
                  >
                    <option value="">—</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </td>
                <td className={`${tdClass} text-right pr-3 text-xs`}>—</td>
                <td className={`${tdClass} text-center`}>
                  <button className="text-xs px-1 hover:text-red-500" onClick={() => setNewRow(null)}>×</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
