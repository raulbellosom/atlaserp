import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, LayoutList, Table2, LayoutGrid } from 'lucide-react'
import {
  Button,
  Input,
  EmptyState,
  LoadingState,
  SelectField,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@atlas/ui'
import { GROUP_BY_OPTIONS } from '../lib/inventory-constants.js'
import { buildGroups } from '../lib/inventory-grouping.js'
import { InventoryStatusBadge } from './InventoryStatusBadge.jsx'

// ── Sub-components ────────────────────────────────────────────────────────────

function GroupHeader({ group, isExpanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.groupColor }} />
      <span className="flex-1 text-sm font-medium text-[hsl(var(--foreground))]">{group.groupLabel}</span>
      <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
        {group.items.length}
      </span>
      {isExpanded
        ? <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        : <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      }
    </button>
  )
}

function TreeView({ groups, expandedGroups, onToggleGroup, onItemClick }) {
  return (
    <div className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))]">
      {groups.map(group => {
        const isExpanded = expandedGroups.has(group.groupKey)
        return (
          <div key={group.groupKey}>
            <GroupHeader group={group} isExpanded={isExpanded} onToggle={() => onToggleGroup(group.groupKey)} />
            {isExpanded && (
              <div className="bg-[hsl(var(--muted)/0.2)]">
                {group.items.length === 0 ? (
                  <p className="px-6 py-3 text-sm text-[hsl(var(--muted-foreground))]">Sin items en este grupo</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
                        <th className="px-6 py-2 text-left font-medium">Tag</th>
                        <th className="px-4 py-2 text-left font-medium">Nombre</th>
                        <th className="px-4 py-2 text-left font-medium">Marca</th>
                        <th className="px-4 py-2 text-left font-medium">Estado</th>
                        <th className="px-4 py-2 text-left font-medium">Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(item => (
                        <tr
                          key={item.id}
                          onClick={() => onItemClick(item)}
                          className="cursor-pointer border-b border-[hsl(var(--border)/0.5)] last:border-0 hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
                        >
                          <td className="px-6 py-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">{item.assetTag ?? '—'}</td>
                          <td className="px-4 py-2 font-medium">{item.name}</td>
                          <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{item.brandName ?? '—'}</td>
                          <td className="px-4 py-2"><InventoryStatusBadge status={item.status} /></td>
                          <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{item.assignedToName ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FlatTableView({ items, onItemClick }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead>Actualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.id} onClick={() => onItemClick(item)} className="cursor-pointer">
              <TableCell className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{item.assetTag ?? '—'}</TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>{item.categoryName ?? '—'}</TableCell>
              <TableCell>{item.brandName ?? '—'}</TableCell>
              <TableCell><InventoryStatusBadge status={item.status} /></TableCell>
              <TableCell>{item.assignedToName ?? '—'}</TableCell>
              <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('es-MX') : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CardsView({ items, onItemClick }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onItemClick(item)}
          className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-left hover:border-[hsl(var(--ring))] hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-sm text-[hsl(var(--foreground))] leading-snug line-clamp-2">{item.name}</span>
            <InventoryStatusBadge status={item.status} />
          </div>
          <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{item.assetTag ?? '—'}</span>
          {item.assignedToName && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{item.assignedToName}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function ViewModeButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={[
        'flex items-center justify-center rounded p-1.5 transition-colors',
        active
          ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function InventoryGroupedView({
  items = [],
  categories = [],
  brands = [],
  locations = [],
  groupBy = 'category',
  onGroupByChange,
  viewMode = 'tree',
  onViewModeChange,
  search = '',
  onSearchChange,
  onItemClick,
  onCreateItem,
  isLoading = false,
}) {
  const [expandedGroups, setExpandedGroups] = useState(() => new Set())

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const groups = buildGroups(items, groupBy, categories, brands, locations)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-50">
          <Input
            placeholder="Buscar item..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <div className="w-44">
          <SelectField
            value={groupBy}
            onValueChange={onGroupByChange}
            options={GROUP_BY_OPTIONS}
            placeholder="Agrupar por..."
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] p-1">
          <ViewModeButton icon={LayoutList} label="Arbol" active={viewMode === 'tree'} onClick={() => onViewModeChange('tree')} />
          <ViewModeButton icon={Table2} label="Tabla" active={viewMode === 'table'} onClick={() => onViewModeChange('table')} />
          <ViewModeButton icon={LayoutGrid} label="Tarjetas" active={viewMode === 'cards'} onClick={() => onViewModeChange('cards')} />
        </div>
        <Button onClick={onCreateItem}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo item
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin items"
          description="Agrega tu primer item de inventario"
          action={{ label: 'Nuevo item', onClick: onCreateItem }}
        />
      ) : viewMode === 'tree' ? (
        <TreeView
          groups={groups}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          onItemClick={onItemClick}
        />
      ) : viewMode === 'table' ? (
        <FlatTableView items={items} onItemClick={onItemClick} />
      ) : (
        <CardsView items={items} onItemClick={onItemClick} />
      )}
    </div>
  )
}
