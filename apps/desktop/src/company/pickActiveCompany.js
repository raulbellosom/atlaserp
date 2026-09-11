// Decides which company should be active given the user's current
// memberships and whatever id was previously persisted. Kept pure/no-React
// so it is unit-testable without a DOM or a QueryClient.
// Spec: docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §6.1

export function pickActiveCompany({ companies, storedId }) {
  const list = Array.isArray(companies) ? companies : []
  if (list.length === 0) return null

  if (storedId != null) {
    const match = list.find((c) => String(c.id) === String(storedId))
    if (match) return String(match.id)
  }

  return String(list[0].id)
}
