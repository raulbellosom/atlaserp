import { ITEM_STATUSES } from '../lib/inventory-constants.js'

export function InventoryStatusBadge({ status, size = 'sm' }) {
  const config = ITEM_STATUSES.find(s => s.value === status)
  if (!config) return null

  const sizeClasses = size === 'sm'
    ? 'text-xs px-2 py-0.5'
    : 'text-sm px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses}`}
      style={{ color: config.color, backgroundColor: config.bgColor }}
    >
      {config.label}
    </span>
  )
}
