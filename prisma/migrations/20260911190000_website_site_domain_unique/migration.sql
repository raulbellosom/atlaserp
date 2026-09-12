-- Called for in the original multi-tenant spec §11 ("Company.domain/
-- WebsiteSite.domain gains a genuine uniqueness constraint (currently
-- missing entirely...)"), and now load-bearing: dist-serve-service.js
-- resolves a request's company by exact-matching its normalized Host header
-- against website_site.domain (migration
-- 20260911170000_calendar_company_scope... no — see
-- apps/api/src/services/dist-serve-service.js resolveSiteForRequest). Two
-- enabled sites sharing a domain would make that resolution silently
-- nondeterministic (whichever happened to load last into the in-memory
-- map). Case-insensitive on the raw stored value (not a full normalized-host
-- unique index) — domain values should already be entered consistently via
-- the website settings UI; this catches the most likely accidental
-- duplicate (same value, different case) without trying to replicate
-- dist-serve-service.js's full normalizeHost logic in SQL.
--
-- Partial (WHERE domain IS NOT NULL): a site with no custom domain (the
-- common case — most sites use the shared instance's default resolution)
-- must not collide with any other domain-less site.

CREATE UNIQUE INDEX website_site_domain_lower_idx ON website_site (lower(domain)) WHERE domain IS NOT NULL;
