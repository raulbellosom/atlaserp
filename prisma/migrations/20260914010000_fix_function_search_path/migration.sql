-- Pins search_path on the only two functions in this schema that were still
-- missing it (Supabase linter: function_search_path_mutable). Every other
-- SECURITY DEFINER function added since already sets this explicitly; these
-- two predate that convention. Neither is SECURITY DEFINER, so the real-world
-- exploit window was already narrow -- this closes it outright rather than
-- leaving an inconsistency.
ALTER FUNCTION public.atlas_unaccent(text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.atlas_guard_office_document() SET search_path = public, pg_catalog;
