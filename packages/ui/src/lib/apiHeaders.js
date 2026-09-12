// Shared header-building helper for every generic blueprint-driven renderer
// (AtlasCrudView, AtlasTable, AtlasForm, AtlasDetail, atlas-detail-hero,
// useAttachmentsController) that talks to the API via raw fetch() instead of
// the @atlas/sdk client. Those all live in @atlas/ui, a host-agnostic package
// that cannot import the host app's own active-company context — so every
// consumer must resolve the active company itself (e.g. via
// useActiveCompany() in apps/desktop) and pass it down as an explicit
// `companyId` prop, mirroring how `token` is already threaded.
//
// Missing this header is not cosmetic: apps/api's requirePermission
// middleware resolves the active company from it, and returns 400
// company_required the moment a user belongs to more than one company (a
// single membership resolves without it) — so a screen built on these
// renderers works for every user until the exact moment they gain a second
// company, then breaks outright. See
// docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md.
export function buildApiHeaders(token, companyId, extra = {}) {
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (companyId) headers["X-Atlas-Company-Id"] = companyId;
  return headers;
}
