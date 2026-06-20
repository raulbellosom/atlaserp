// apps/desktop/src/modules/atlas.ledger/screens/SpreadsheetRegister.jsx
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOfflineStatus } from '@atlas/offline'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { useAccountTransactions } from '../hooks/use-ledger-queries.js'

const API_BASE = getApiUrl()

const EDITABLE_COLS = ['fecha', 'tipo_id', 'numero', 'nombre', 'referencia', 'concepto', 'deposito', 'retiro', 'category_id']

function fmtDecimal(value) {
  if (value == null || value === '') return ''
  const amount = Number(value)
  return Number.isFinite(amount)
    ? amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : ''
}

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
  const { isOnline } = useOfflineStatus()
  const token = session?.access_token ?? null
  const queryClient = useQueryClient()
  const [editingRows, setEditingRows] = useState({})
  const [newRow, setNewRow] = useState(null)
  const tableRef = useRef(null)
  const canEdit = isOnline && !!token

  const queryKey = ['ledger-transactions', accountId, dateFrom ?? null, dateTo ?? null, 'remote']
  const { data, isLoading, isError } = useAccountTransactions(accountId, { dateFrom, dateTo })

  const saveMutation = useMutation({
    mutationFn: async ({ isNew, id, payload }) => {
      const url = isNew
        ? `${API_BASE}/ledger/accounts/${accountId}/transactions`
        : `${API_BASE}/ledger/accounts/${accountId}/transactions/${id}`
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
          data: old.data.map((row) => (
            row.id === id ? { ...row, ...payload, _pending: true } : row
          )),
        }
      })
      return { previousData }
    },
    onError: (error, _vars, context) => {
      if (context?.previousData) queryClient.setQueryData(queryKey, context.previousData)
      toast.error(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['ledger-account', accountId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (txId) => {
      const res = await fetch(
        `${API_BASE}/ledger/accounts/${accountId}/transactions/${txId}/enabled`,
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
      queryClient.invalidateQueries({ queryKey: ['ledger-account', accountId] })
    },
    onError: (error) => { toast.error(error.message) },
  })

  function getDraft(row, rowIdx) {
    const key = row.id ?? `new-${rowIdx}`
    return editingRows[key] ?? row
  }

  function setDraft(row, rowIdx, field, value) {
    if (!canEdit) return
    const key = row.id ?? `new-${rowIdx}`
    setEditingRows((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? row), [field]: value, _dirty: true },
    }))
  }

  function clearDraft(row, rowIdx) {
    const key = row.id ?? `new-${rowIdx}`
    setEditingRows((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function saveRow(row, rowIdx) {
    if (!canEdit) return
    const draft = getDraft(row, rowIdx)
    if (!draft._dirty && !draft._isNew) return

    const deposito = draft.deposito !== '' && draft.deposito != null ? Number(draft.deposito) : null
    const retiro = draft.retiro !== '' && draft.retiro != null ? Number(draft.retiro) : null

    if (!draft.nombre?.trim()) {
      toast.error('El campo Nombre es obligatorio.')
      return
    }
    if (!deposito && !retiro) {
      toast.error('Se requiere deposito o retiro mayor a cero.')
      return
    }

    const payload = {
      fecha: toDateValue(draft.fecha),
      tipo_id: draft.tipo_id || null,
      numero: draft.numero || null,
      nombre: draft.nombre.trim(),
      referencia: draft.referencia || null,
      concepto: draft.concepto || null,
      deposito,
      retiro,
      category_id: draft.category_id || null,
    }

    saveMutation.mutate({ isNew: !!draft._isNew, id: row.id, payload })
    clearDraft(row, rowIdx)
    if (draft._isNew) setNewRow(null)
  }

  function handleKeyDown(event, row, rowIdx, colName) {
    const rows = data?.data ?? []

    if (event.key === 'Escape') {
      event.preventDefault()
      clearDraft(row, rowIdx)
      return
    }

    // Ctrl+Enter → save immediately; plain Enter → advance to next column (mobile-friendly)
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.ctrlKey) {
        saveRow(row, rowIdx)
        return
      }
      const colIdx = EDITABLE_COLS.indexOf(colName)
      if (colIdx < EDITABLE_COLS.length - 1) {
        const selector = `[data-row="${rowIdx}"][data-col="${EDITABLE_COLS[colIdx + 1]}"]`
        tableRef.current?.querySelector(selector)?.focus()
      } else {
        saveRow(row, rowIdx)
      }
      return
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const direction = event.key === 'ArrowUp' ? -1 : 1
      const nextIdx = rowIdx + direction
      if (nextIdx < 0 || nextIdx >= rows.length) return
      const colIdx = EDITABLE_COLS.indexOf(colName)
      const selector = `[data-row="${nextIdx}"][data-col="${EDITABLE_COLS[colIdx]}"]`
      tableRef.current?.querySelector(selector)?.focus()
    }
  }

  function handleRowBlur(event, row, rowIdx) {
    const nextFocused = event.relatedTarget
    const rowEl = event.currentTarget
    if (rowEl.contains(nextFocused)) return
    saveRow(row, rowIdx)
  }

  const rows = data?.data ?? []

  const colClass = 'px-2 py-0 h-8 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] rounded w-full'
  const thClass = 'px-2 py-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] text-left whitespace-nowrap border-b border-r border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] select-none last:border-r-0'
  const tdClass = 'border-b border-r border-[hsl(var(--border)/0.5)] p-0 align-middle last:border-r-0'

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
          <div className="h-3.5 w-24 rounded bg-[hsl(var(--muted))] animate-pulse" />
          <div className="h-7 w-20 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
        </div>
        <div className="flex-1 overflow-hidden">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[hsl(var(--muted)/0.3)]">
                {[16, 64, 56, 80, 72, 96, 112, 72, 72, 72, 64].map((width, index) => (
                  <th key={index} className="px-2 py-1.5 border-b border-[hsl(var(--border))]">
                    <div className="h-3 rounded bg-[hsl(var(--muted))] animate-pulse" style={{ width }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }).map((_, rowIdx) => (
                <tr key={rowIdx} className={rowIdx % 2 === 1 ? 'bg-[hsl(var(--muted)/0.15)]' : ''}>
                  {[16, 64, 56, 80, 72, 96, 112, 72, 72, 72, 64].map((width, colIdx) => (
                    <td key={colIdx} className="border-b border-[hsl(var(--border)/0.5)] px-2 py-1 align-middle">
                      <div className="h-3 rounded bg-[hsl(var(--muted))] animate-pulse" style={{ width }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (isError) {
    return <div className="p-4 text-sm text-red-500">No se pudieron cargar los movimientos.</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {rows.length} movimiento{rows.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setNewRow({ ...emptyRow(accountId), numero: String(rows.length + 1) })}
          disabled={!!newRow || !canEdit}
        >
          <Plus size={13} className="mr-1" />
          Agregar
        </Button>
      </div>

      {!canEdit && (
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
          Viendo movimientos en modo solo lectura offline. Para agregar, editar o eliminar reconecta la app.
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table ref={tableRef} className="w-full min-w-262.5 border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${thClass} w-10 text-center`}>#</th>
              <th className={`${thClass} w-28`}>Fecha</th>
              <th className={`${thClass} w-32`}>Tipo</th>
              <th className={`${thClass} w-24`}>Numero</th>
              <th className={`${thClass} min-w-40`}>Nombre</th>
              <th className={`${thClass} w-28`}>Referencia</th>
              <th className={`${thClass} min-w-32`}>Concepto</th>
              <th className={`${thClass} w-28 text-right`}>Ingreso</th>
              <th className={`${thClass} w-28 text-right`}>Egreso</th>
              <th className={`${thClass} w-36`}>Categoria</th>
              <th className={`${thClass} w-28 text-right`}>Saldo</th>
              <th className={`${thClass} w-8`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const draft = getDraft(row, rowIdx)
              return (
                <tr
                  key={row.id}
                  onBlur={(event) => handleRowBlur(event, row, rowIdx)}
                  className="hover:bg-[hsl(var(--muted)/0.2)]"
                >
                  <td className={`${tdClass} text-center text-xs text-[hsl(var(--muted-foreground))]`}>
                    {row.consecutive}
                  </td>
                  <td className={tdClass}>
                    <input
                      type="date"
                      aria-label={`Fecha movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="fecha"
                      disabled={!canEdit}
                      enterKeyHint="next"
                      value={toDateValue(draft.fecha)}
                      onChange={(event) => setDraft(row, rowIdx, 'fecha', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'fecha')}
                    />
                  </td>
                  <td className={tdClass}>
                    <select
                      aria-label={`Tipo movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="tipo_id"
                      disabled={!canEdit}
                      value={draft.tipo_id ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'tipo_id', event.target.value || null)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'tipo_id')}
                    >
                      <option value="">—</option>
                      {types.map((type) => <option key={type.id} value={type.id}>{type.code}</option>)}
                    </select>
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      aria-label={`Numero movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="numero"
                      disabled={!canEdit}
                      enterKeyHint="next"
                      value={draft.numero ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'numero', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'numero')}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      aria-label={`Nombre movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="nombre"
                      disabled={!canEdit}
                      enterKeyHint="next"
                      value={draft.nombre ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'nombre', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'nombre')}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      aria-label={`Referencia movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="referencia"
                      disabled={!canEdit}
                      enterKeyHint="next"
                      value={draft.referencia ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'referencia', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'referencia')}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      aria-label={`Concepto movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="concepto"
                      disabled={!canEdit}
                      enterKeyHint="next"
                      value={draft.concepto ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'concepto', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'concepto')}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      aria-label={`Ingreso movimiento ${row.consecutive ?? rowIdx + 1}`}
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      enterKeyHint="next"
                      className={`${colClass} text-right`}
                      data-row={rowIdx}
                      data-col="deposito"
                      disabled={!canEdit}
                      value={draft.deposito ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'deposito', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'deposito')}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      aria-label={`Egreso movimiento ${row.consecutive ?? rowIdx + 1}`}
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      enterKeyHint="next"
                      className={`${colClass} text-right`}
                      data-row={rowIdx}
                      data-col="retiro"
                      disabled={!canEdit}
                      value={draft.retiro ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'retiro', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'retiro')}
                    />
                  </td>
                  <td className={tdClass}>
                    <select
                      aria-label={`Categoria movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="category_id"
                      disabled={!canEdit}
                      value={draft.category_id ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'category_id', event.target.value || null)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'category_id')}
                    >
                      <option value="">—</option>
                      {categories.filter(c => c.is_system).length > 0 && (
                        <optgroup label="Sistema">
                          {categories.filter(c => c.is_system).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                      )}
                      {categories.filter(c => !c.is_system).length > 0 && (
                        <optgroup label="Mis categorias">
                          {categories.filter(c => !c.is_system).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                      )}
                      {categories.every(c => c.is_system === undefined) && categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className={`${tdClass} text-right pr-3 text-xs font-mono font-semibold`}>
                    {fmtDecimal(row.saldo_actual)}
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <button
                      type="button"
                      aria-label={`Eliminar movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className="text-[hsl(var(--muted-foreground))] hover:text-red-500 text-xs px-1 disabled:opacity-40"
                      disabled={!canEdit}
                      onClick={() => deleteMutation.mutate(row.id)}
                      title="Eliminar"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}

            {newRow && (
              <tr
                onBlur={(event) => {
                  const nextFocused = event.relatedTarget
                  if (event.currentTarget.contains(nextFocused)) return
                  saveRow(newRow, rows.length)
                }}
                className="bg-[hsl(var(--muted)/0.3)]"
              >
                <td className={`${tdClass} text-center text-xs text-[hsl(var(--muted-foreground))]`}>*</td>
                <td className={tdClass}>
                  <input
                    type="date"
                    aria-label="Fecha nuevo movimiento"
                    className={colClass}
                    autoFocus
                    disabled={!canEdit}
                    enterKeyHint="next"
                    value={newRow.fecha}
                    onChange={(event) => setNewRow((row) => ({ ...row, fecha: event.target.value, _dirty: true }))}
                    onKeyDown={(event) => { if (event.key === 'Escape') setNewRow(null) }}
                  />
                </td>
                <td className={tdClass}>
                  <select
                    aria-label="Tipo nuevo movimiento"
                    className={colClass}
                    disabled={!canEdit}
                    value={newRow.tipo_id ?? ''}
                    onChange={(event) => setNewRow((row) => ({ ...row, tipo_id: event.target.value || null, _dirty: true }))}
                  >
                    <option value="">—</option>
                    {types.map((type) => <option key={type.id} value={type.id}>{type.code}</option>)}
                  </select>
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    aria-label="Numero nuevo movimiento"
                    className={colClass}
                    disabled={!canEdit}
                    enterKeyHint="next"
                    value={newRow.numero}
                    onChange={(event) => setNewRow((row) => ({ ...row, numero: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    aria-label="Nombre nuevo movimiento"
                    className={colClass}
                    placeholder="Nombre *"
                    disabled={!canEdit}
                    enterKeyHint="next"
                    value={newRow.nombre}
                    onChange={(event) => setNewRow((row) => ({ ...row, nombre: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    aria-label="Referencia nuevo movimiento"
                    className={colClass}
                    disabled={!canEdit}
                    enterKeyHint="next"
                    value={newRow.referencia}
                    onChange={(event) => setNewRow((row) => ({ ...row, referencia: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    aria-label="Concepto nuevo movimiento"
                    className={colClass}
                    disabled={!canEdit}
                    enterKeyHint="next"
                    value={newRow.concepto}
                    onChange={(event) => setNewRow((row) => ({ ...row, concepto: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="number"
                    aria-label="Ingreso nuevo movimiento"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    enterKeyHint="next"
                    className={`${colClass} text-right`}
                    disabled={!canEdit}
                    value={newRow.deposito}
                    onChange={(event) => setNewRow((row) => ({ ...row, deposito: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="number"
                    aria-label="Egreso nuevo movimiento"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    enterKeyHint="next"
                    className={`${colClass} text-right`}
                    disabled={!canEdit}
                    value={newRow.retiro}
                    onChange={(event) => setNewRow((row) => ({ ...row, retiro: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <select
                    aria-label="Categoria nuevo movimiento"
                    className={colClass}
                    disabled={!canEdit}
                    value={newRow.category_id ?? ''}
                    onChange={(event) => setNewRow((row) => ({ ...row, category_id: event.target.value || null, _dirty: true }))}
                  >
                    <option value="">—</option>
                    {categories.filter(c => c.is_system).length > 0 && (
                      <optgroup label="Sistema">
                        {categories.filter(c => c.is_system).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </optgroup>
                    )}
                    {categories.filter(c => !c.is_system).length > 0 && (
                      <optgroup label="Mis categorias">
                        {categories.filter(c => !c.is_system).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </optgroup>
                    )}
                    {categories.every(c => c.is_system === undefined) && categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className={`${tdClass} text-right pr-3 text-xs`}>—</td>
                <td className={`${tdClass} text-center`}>
                  <button type="button" aria-label="Cancelar nuevo movimiento" className="text-xs px-1 hover:text-red-500 disabled:opacity-40" disabled={!canEdit} onClick={() => setNewRow(null)}>
                    ×
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
