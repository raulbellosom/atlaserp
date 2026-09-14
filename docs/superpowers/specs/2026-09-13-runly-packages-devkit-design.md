# Runly - packages and Dev Kit

Date: 2026-09-13
Status: Complete (local stage 3a)
Authorization: user requested continuing the incremental migration.

## 1. Feature title

Runly packages, SDK and Dev Kit with legacy import compatibility.

## 2. Status

Complete locally. See the implementation plan for verification evidence and rollout limits.

## 3. Context

Visible branding and distribution have been migrated. Source imports, SDK and module authoring still use Atlas package names.

## 4. Problem

Renaming packages without aliases would prevent installed/custom modules from resolving their dependencies.

## 5. Goals

Canonical @runly/* workspaces and source imports; legacy @atlas/* imports resolve to the same module objects. New public SDK package name and authoring exports. New Dev Kit defaults without moving existing installations.

## 6. Non-goals

Environment-variable migration (stage 3b), database/module keys, HTTP headers, runtime globals, native identifiers, assets, production URLs, npm/Docker publication or deployment. @raulbellosom/atlas-web-builder is a separately published dependency and remains unchanged.

## 7. User stories

As a module author I want Runly package names while existing modules continue to load.

## 8. UX requirements

Same layouts and behavior. Document new imports and supported legacy aliases.

## 9. Routes/screens

No route changes.

## 10. Data model

No database changes.

## 11. Prisma impact

No schema, migration, seed or sync. Update source package imports only.

## 12. API contract

No HTTP changes. Bundle compiler accepts both scopes; frontend importmaps map both to the same shim URL.

## 13. SDK contract

Canonical @runly/sdk adds createRunlyClient as the identical factory exported under createAtlasClient. Public storefront package becomes @raulbellosom/runly-sdk locally, pending publication; request headers and methods remain compatible.

## 14. Validator contract

@runly/validators, same schemas; @atlas/validators retained as an alias.

## 15. Module manifest impact

Add defineRunlyModule alias to the same defineAtlasModule implementation. Module keys, schemas and AME3 format unchanged. Golden-path example uses canonical imports.

## 16. Navigation impact

None.

## 17. Blueprint impact

RunlyTable/Form/Detail/CrudView/CardView aliases reference existing renderers. Existing component names remain exported.

## 18. RBAC/permissions

No permission or role-key changes.

## 19. Multi-company behavior

Unchanged; SDK company headers and active-company state retain their identity across aliases.

## 20. Files/storage impact

New installations use _runly-devkit; existing _atlas-devkit directories are reused. No moving/deleting customer folders. Regenerate only the versioned Dev Kit export.

## 21. Export/import requirements

pnpm workspace aliases link old and new names to the same implementation. Preserve the atlasUiExports contract field while adding runlyUiExports. Export machine-readable supported legacy imports.

## 22. Audit log requirements

N/A; repository evidence only.

## 23. Edge cases

Mixed old/new imports must not duplicate module registries, SDK objects or React contexts. Both development and production importmaps need aliases. An existing legacy Dev Kit must not be orphaned. Frozen installation must accept the regenerated lockfile.

## 24. Risks

Published old modules require both scopes at runtime. Keep aliases and test mixed bundles. New npm SDK name is unavailable until publication: documentation explicitly labels this release prerequisite. Do not rename unrelated externally published dependencies.

## 25. Acceptance criteria

Canonical imports build; old/new Node imports resolve to identical exports; both scopes remain external in bundles and resolve to identical browser shims. Dev Kit installation preserves legacy folders. SDK and web builds plus focused regression tests pass.

## 26. Verification plan

pnpm lockfile regeneration followed by frozen install; node:test package alias, bundler, importmap, installer and Dev Kit suites; build web and storefront SDK; lint and React Doctor. No production calls.

## 27. Rollback plan

Restore only this stage and its lockfile, then install with the restored lockfile. Previous branding/distribution stages remain intact. No data rollback needed.

## 28. Future enhancements

Stage 3b environment variables and browser globals; stored module keys/data; native/offline identities; domain and publication; assets/palette.

