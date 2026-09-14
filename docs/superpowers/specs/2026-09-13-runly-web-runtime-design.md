# Runly web runtime compatibility

Date: 2026-09-13

## 1. Title
Stage 4b increment 2: migrated module identities in the web runtime.
## 2. Status
Complete locally for this increment. Full runtime/data cutover remains pending.
## 3. Context
The user permits considering a test-database reset if needed. This increment does not require one.
## 4. Problem
Runly-only runtime catalogs lose built-in screens, sidebar slots, company styling and old component registrations; local manifests may create duplicate alias entries.
## 5. Goals
Preserve persisted identity while resolving official implementation aliases, navigation and components.
## 6. Non-goals
No database reset, seed switch, full child-screen migration, PWA/native identity rename, asset/palette changes or deployment.
## 7. User stories
A migrated module opens its existing screen and registered components; old catalogs continue working.
## 8. UX
Same screens, launch destinations and layout features; retain access checks before redirects/rendering.
## 9. Routes
Exact registered paths retain precedence. Normalize only an official module's own navigation prefix, including nested children.
## 10. Data model
No stored changes. Runtime rows retain UUID/key/status/enablement from the API.
## 11. Prisma
No Prisma changes.
## 12. API
No API changes; empty/filtered API navigation must remain authoritative in the user runtime.
## 13. SDK
Reuse the explicit core alias catalog; no new dependencies or public SDK changes.
## 14. Validation
Unknown/custom namespaces never alias; exact catalog collisions remain distinct.
## 15. Modules
Resolve local manifests against persisted module identity without duplicate alias rows.
## 16. Navigation
Normalize nested paths without mutating source manifests; preserve query/hash and permission metadata.
## 17. Blueprints
Resolve official component namespace aliases against known active module ownership.
## 18. RBAC
Inactive exact module ownership cannot fall through to an active counterpart; an explicitly empty active catalog blocks namespaced components.
## 19. Tenancy
Preserve API filtering. Alias handling does not add locally bundled modules to the authenticated runtime.
## 20. Files
Extract pure runtime merging and screen resolution to testable JavaScript modules; original Vite manifest glob remains in the adapter.
## 21. Import/export
No generated Dev Kit, bundle filenames or module directory moves.
## 22. Audit
Targeted Node tests exercise both spellings, collisions, navigation restrictions and component visibility.
## 23. Edge cases
Runly-only/Atlas-only/both/unknown catalogs; custom fallbacks; nested navigation; empty active catalogs; old registration names.
## 24. Risks
Child screens, backend seeding/discovery and PWA still contain legacy identities. This increment alone does not make an installation ready for key conversion.
## 25. Acceptance
Both spellings select the same built-in implementation; exact persisted identities and filtered navigation survive merging; component aliases do not bypass active ownership.
## 26. Verification
Node tests, web build, scoped ESLint, React Doctor and diff checks.
## 27. Rollback
Restore only this increment's source changes. Existing working-tree migration changes and user assets must remain.
## 28. Future
Complete backend read/write/seed compatibility and child-screen paths, then choose reset or data conversion for the identified test installation.
