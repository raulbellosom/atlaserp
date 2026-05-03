# Atlas ERP — Next Steps

## Current: Phase 0+1

### Phase 0 — Repository and environment cleanup
Remove obsolete local-lite stack, write numbered docs, align .env.example to Supabase-first, add atlas.branding manifest and InstanceConfig schema model.

**Success:** Repo has one coherent view of the architecture. All docs reference https://supabase.racoondevs.com.

### Phase 1 — Supabase + Prisma connection
Connect to live Supabase, run migrations, seed 4 core modules, verify API responds.

**Success:** `GET /health` returns 200. `GET /modules` returns 4 core modules from Supabase.

---

## Upcoming phases

Each phase gets its own brainstorm → spec → plan → implement cycle.

### Phase 2 — ERP initialization state
- `GET /instance/status` API endpoint
- Frontend route guard: uninitialized → `/setup`, initialized → `/login`

### Phase 3 — Onboarding setup wizard
- 4-step wizard UI (admin account, company info, branding, review)
- `POST /setup/initialize` API endpoint
- Create Supabase Auth user, UserProfile, Company, BrandingConfig
- Add BrandingConfig Prisma model
- Mark instance as initialized

### Phase 4 — Auth integration
- Login screen (company-branded with logo + colors from API)
- Supabase Auth `signInWithPassword`
- Session persistence and logout
- JWT verification middleware in Atlas API
- UserProfile + permission loading on each request

### Phase 5 — Atlas shell and module registry UI
- React Router setup
- Module launcher (home screen, app grid)
- Module-specific layouts and sidebars
- Module catalog: install, disable, view status
- Core module protection enforced in UI and API

### Phase 6 — Contacts module (first full business module)
- Full CRUD API with service layer
- Blueprint-driven list and form UI (DynamicForm + DynamicTable)
- Contact types: customer, supplier, person, company
- Expose contact picker to other modules via `exposes`

### Phase 7 — Files module
- Supabase Storage bucket creation
- Upload endpoint with FileAsset metadata
- Download/signed URL endpoint
- FileUploader and FileViewer reusable components
- Company logo upload connected to atlas.branding

### Phase 8+ — Business modules
Finance, Purchases, Inventory, HR, Fleet, Reports — one per brainstorm cycle.

---

## Architecture references

| Document | Contents |
|---|---|
| [01_erp_architecture.md](01_erp_architecture.md) | Full system architecture and data flows |
| [02_module_system.md](02_module_system.md) | Module manifest contract and lifecycle |
| [03_core_modules.md](03_core_modules.md) | Core module definitions |
| [04_onboarding_setup.md](04_onboarding_setup.md) | Setup wizard design |
| [05_supabase_prisma_strategy.md](05_supabase_prisma_strategy.md) | Supabase + Prisma integration |
| [06_deployment_strategy.md](06_deployment_strategy.md) | Deployment guide |
| [07_auth_permissions_strategy.md](07_auth_permissions_strategy.md) | Auth and RBAC strategy |
| [08_blueprints.md](08_blueprints.md) | Blueprint system reference |
