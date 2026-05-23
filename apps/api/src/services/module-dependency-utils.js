function toDependencyRecord(dep) {
  if (typeof dep === 'string') {
    const key = dep.trim()
    return key ? { key, optional: false, versionRange: null } : null
  }
  if (!dep || typeof dep !== 'object' || Array.isArray(dep)) return null

  const rawKey = typeof dep.key === 'string' ? dep.key.trim() : ''
  if (!rawKey) return null

  const versionRange =
    typeof dep.versionRange === 'string' && dep.versionRange.trim()
      ? dep.versionRange.trim()
      : null

  return {
    key: rawKey,
    optional: Boolean(dep.optional),
    versionRange,
  }
}

export function normalizeManifestDependencies(dependencies = []) {
  const records = new Map()
  const safeDependencies = Array.isArray(dependencies) ? dependencies : []

  for (const rawDep of safeDependencies) {
    const dep = toDependencyRecord(rawDep)
    if (!dep) continue

    const current = records.get(dep.key)
    if (!current) {
      records.set(dep.key, dep)
      continue
    }

    records.set(dep.key, {
      key: dep.key,
      optional: current.optional && dep.optional,
      versionRange: dep.versionRange ?? current.versionRange,
    })
  }

  return [...records.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function findCycleFromNode(startNode, adjacency) {
  const visited = new Set()
  const visiting = new Set()
  const stack = []

  function visit(node) {
    if (visiting.has(node)) {
      const cycleStartIndex = stack.indexOf(node)
      if (cycleStartIndex === -1) return [node, node]
      const cyclePath = stack.slice(cycleStartIndex)
      cyclePath.push(node)
      return cyclePath
    }
    if (visited.has(node)) return null

    visiting.add(node)
    stack.push(node)

    const neighbors = adjacency.get(node) ?? []
    for (const neighbor of neighbors) {
      const cycle = visit(neighbor)
      if (cycle) return cycle
    }

    stack.pop()
    visiting.delete(node)
    visited.add(node)
    return null
  }

  return visit(startNode)
}

export function detectRequiredDependencyCycle({ moduleId, requiredDependencyIds = [], existingRequiredEdges = [] }) {
  if (!moduleId) return null

  const adjacency = new Map()
  for (const edge of Array.isArray(existingRequiredEdges) ? existingRequiredEdges : []) {
    if (!edge || !edge.moduleId || !edge.dependencyId) continue
    const list = adjacency.get(edge.moduleId) ?? []
    list.push(edge.dependencyId)
    adjacency.set(edge.moduleId, list)
  }

  adjacency.set(moduleId, [...new Set(requiredDependencyIds.filter(Boolean))])

  const cycle = findCycleFromNode(moduleId, adjacency)
  if (!cycle || cycle.length < 2) return null
  return cycle
}

export function formatDependencyCycle({ cycle = [], idToKey = new Map() }) {
  const safeCycle = Array.isArray(cycle) ? cycle : []
  if (!safeCycle.length) return ''

  return safeCycle
    .map((id) => {
      const key = idToKey instanceof Map ? idToKey.get(id) : null
      return typeof key === 'string' && key.trim() ? key : String(id)
    })
    .join(' -> ')
}
