import { useState } from 'react'
import { Button, Input, ConfirmDialog } from '@atlas/ui'

const KIND_LABELS = {
  TABLE_SQUARE: 'Mesa cuadrada',
  TABLE_ROUND: 'Mesa redonda',
  BAR: 'Barra',
  WALL: 'Pared',
  PLANT: 'Planta',
  DOOR: 'Puerta',
}

export function FloorPropertiesPanel({ element, onUpdate, onRemove }) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!element) {
    return (
      <div className="w-56 shrink-0 border-l border-border bg-card flex flex-col overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-4 pb-2">
          Propiedades
        </div>
        <div className="flex flex-col gap-3 px-3 pb-4">
          <p className="text-xs text-muted-foreground">Selecciona un elemento para ver propiedades</p>
        </div>
      </div>
    )
  }

  const isTable = element.kind.startsWith('TABLE_')

  return (
    <div className="w-56 shrink-0 border-l border-border bg-card flex flex-col overflow-y-auto">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-4 pb-2">
        Propiedades
      </div>
      <div className="flex flex-col gap-3 px-3 pb-4">
        {/* Tipo */}
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Tipo</p>
          <p className="text-sm font-medium">{KIND_LABELS[element.kind] ?? element.kind}</p>
        </div>

        {/* Table-specific fields */}
        {isTable && (
          <>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
              <Input
                value={element.tableName ?? ''}
                onChange={(e) => onUpdate({ tableName: e.target.value })}
                placeholder="Nombre de la mesa"
                size="sm"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Capacidad</label>
              <Input
                type="number"
                min={1}
                max={99}
                value={element.capacity ?? 2}
                onChange={(e) => onUpdate({ capacity: Math.max(1, Number(e.target.value) || 1) })}
                size="sm"
              />
            </div>
          </>
        )}

        {/* Non-table label */}
        {!isTable && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Etiqueta</label>
            <Input
              value={element.label ?? ''}
              onChange={(e) => onUpdate({ label: e.target.value || null })}
              placeholder="Opcional"
              size="sm"
            />
          </div>
        )}

        {/* Width and Height grid */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ancho</label>
            <Input
              type="number"
              min={40}
              value={Math.round(element.width)}
              onChange={(e) => onUpdate({ width: Math.max(40, Number(e.target.value) || 40) })}
              size="sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Alto</label>
            <Input
              type="number"
              min={40}
              value={Math.round(element.height)}
              onChange={(e) => onUpdate({ height: Math.max(40, Number(e.target.value) || 40) })}
              size="sm"
            />
          </div>
        </div>

        {/* Delete button */}
        <Button
          variant="destructive"
          size="sm"
          className="mt-1"
          onClick={() => setDeleteOpen(true)}
        >
          Eliminar elemento
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => !v && setDeleteOpen(false)}
        title="Eliminar elemento"
        description={
          isTable
            ? 'La mesa se eliminara del plano. Si tiene ordenes activas, la mesa no podra deshabilitarse hasta que se cierren.'
            : 'Se eliminara este elemento del plano.'
        }
        detail={isTable ? element.tableName : element.label}
        confirmLabel="Eliminar"
        onConfirm={onRemove}
      />
    </div>
  )
}
