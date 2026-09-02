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

export function createSearchRouter({ prisma, getUserContext }) {
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

    const companyId = context.memberships?.[0]?.companyId ?? null;
    if (!companyId) {
      return c.json({ query: q, groups: [] });
    }

    const limit = clampLimit(c.req.query("limit"));
    const allowed = SEARCH_PROVIDERS.filter(
      (provider) =>
        context.isAdmin || context.permissionSet?.has(provider.permission),
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
