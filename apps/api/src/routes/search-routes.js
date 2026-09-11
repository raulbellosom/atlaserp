// GET /search — global record search across permission-gated providers.
import { Hono } from "hono";
import { SEARCH_PROVIDERS } from "../services/search-providers.js";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

function clampLimit(raw) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

// resolveTenantContext: the same X-Atlas-Company-Id-validating resolver
// requirePermission/requireAnyPermission use, injected rather than imported
// (index.js imports this router — importing back from index.js would be
// circular). See
// docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §5.
export function createSearchRouter({ prisma, getUserContext, resolveTenantContext }) {
  const app = new Hono();

  app.get("/search", async (c) => {
    const context = await getUserContext(c);
    if (!context?.profile) {
      return c.json({ error: "No autorizado." }, 401);
    }

    const q = String(c.req.query("q") ?? "").trim();
    if (q.length < MIN_QUERY_LENGTH) {
      return c.json({ query: q, groups: [] });
    }

    // Non-strict: /search has no dedicated permission gate of its own (it
    // filters providers per-provider below), so a multi-company user with no
    // active-company header yet still gets a (permission-less, hence empty)
    // response instead of a hard 400 — matches /runtime/modules' bootstrap
    // treatment, not requirePermission's strict one.
    const resolved = await resolveTenantContext(c, context, { strict: false });
    if (!resolved.ok) return resolved.response;
    const { tenant } = resolved;

    const companyId = tenant.companyId;
    if (!companyId) {
      return c.json({ query: q, groups: [] });
    }

    const limit = clampLimit(c.req.query("limit"));
    const allowed = SEARCH_PROVIDERS.filter(
      (provider) =>
        tenant.isAdmin || tenant.permissionSet?.has(provider.permission),
    );

    const settled = await Promise.allSettled(
      allowed.map((provider) =>
        provider.run({
          prisma,
          companyId,
          actorId: context.profile.id,
          q,
          limit,
        }),
      ),
    );

    const groups = [];
    settled.forEach((result, index) => {
      const provider = allowed[index];
      if (result.status === "rejected") {
        if (process.env.NODE_ENV !== "production") {
          console.error(`[search:${provider.source}]`, result.reason?.message);
        }
        return;
      }
      const items = Array.isArray(result.value) ? result.value : [];
      if (items.length === 0) return;
      groups.push({
        source: provider.source,
        label: provider.label,
        items: items.map((item) => ({
          ...item,
          source: provider.source,
          target: provider.target(item.id),
        })),
      });
    });

    return c.json({ query: q, groups });
  });

  return app;
}
