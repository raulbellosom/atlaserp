-- Renames the 4 physical tables that still carried the "atlas_" prefix from
-- before the Runly rebrand. Plain PostgreSQL renames: foreign keys, indexes
-- and constraints on other tables keep pointing at the same table by OID, so
-- company_module / module_dependency / blueprint / atlas_field / atlas_view
-- need no changes here. Prisma model names and JS call sites (prisma.atlasModule,
-- etc.) are unaffected -- only the @@map() target changes, in prisma/schema.prisma.
ALTER TABLE "atlas_module" RENAME TO "runly_module";
ALTER TABLE "atlas_model" RENAME TO "runly_model";
ALTER TABLE "atlas_field" RENAME TO "runly_field";
ALTER TABLE "atlas_view" RENAME TO "runly_view";
