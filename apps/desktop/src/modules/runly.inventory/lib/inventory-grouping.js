import { ITEM_STATUSES } from './inventory-constants.js'

/**
 * Groups an array of inventory items by the given dimension.
 * Returns [{ groupKey, groupLabel, groupColor, items[] }].
 */
export function buildGroups(items, groupBy, categories = [], brands = [], locations = []) {
  const map = new Map()

  for (const item of items) {
    let key, label, color

    if (groupBy === 'category') {
      key = item.categoryId ?? '__none__'
      const cat = categories.find(c => c.id === item.categoryId)
      label = cat?.name ?? 'Sin categoria'
      color = cat?.color ?? '#6b7280'
    } else if (groupBy === 'brand') {
      key = item.brandId ?? '__none__'
      const brand = brands.find(b => b.id === item.brandId)
      label = brand?.name ?? 'Sin marca'
      color = '#6b7280'
    } else if (groupBy === 'status') {
      key = item.status ?? '__none__'
      const s = ITEM_STATUSES.find(s => s.value === item.status)
      label = s?.label ?? item.status ?? 'Sin estado'
      color = s?.color ?? '#6b7280'
    } else if (groupBy === 'location') {
      key = item.locationId ?? '__none__'
      const loc = locations.find(l => l.id === item.locationId)
      label = loc?.name ?? 'Sin ubicacion'
      color = '#6b7280'
    } else {
      // assignee
      key = item.assignedToId ?? '__none__'
      label = item.assignedToName ?? 'Sin asignar'
      color = '#6b7280'
    }

    if (!map.has(key)) {
      map.set(key, { groupKey: key, groupLabel: label, groupColor: color, items: [] })
    }
    map.get(key).items.push(item)
  }

  return Array.from(map.values())
}
