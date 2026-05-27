# AME3 Runtime Capabilities (Installer Mode)

This document defines what custom modules can use when Atlas ERP is installed from Docker images (without full source build).

## Scope

Installer mode means:
- API and worker run from published images.
- Web runs from a prebuilt Vite bundle image.
- Custom modules are edited in `custom-modules/`.

## What Works Today Without Rebuilding Web

- AME3 module manifest (`defineAtlasModule`)
- Module models (`defineModel`) and Atlas ORM provisioning flow
- Module API routes/services/validators
- Module lifecycle operations (`sync`, install, uninstall, reset)
- Blueprint-driven views and pages using supported renderer contracts

This is enough for most backend + metadata-driven module work.

## View Kinds and Blueprint Contracts

Supported AME3 kinds (current architecture):
- `TABLE`
- `FORM`
- `DETAIL`
- `PAGE`
- `CUSTOM` (with important limitation below)

Reference:
- `docs/03_custom_modules.md`
- `docs/08_blueprints.md`

## UI Components Available to Blueprints

Blueprint renderer targets in the current shell:
- `AtlasTable`
- `AtlasForm`
- `AtlasDetail`
- `AtlasCrudView`

Common shared UI primitives are exported from:
- `packages/ui/src/index.js`

Examples include table/form controls, dialogs, tabs, badges, page headers, filters, pickers, file widgets, etc.

## Frontend Libraries Available in the Published Web Image

Authoritative source:
- `apps/desktop/package.json`

Current key libraries include:
- `react`, `react-dom`, `react-router-dom`
- `@tanstack/react-query`
- `@supabase/supabase-js`
- `zustand`
- `react-hook-form`
- `recharts`
- `lucide-react`
- `sonner`
- `motion`
- `country-state-city`

## Important Limitation: New React Components

In installer mode, the web bundle is precompiled. Because of that:
- Adding a new React component in `custom-modules/*/components` is not automatically available in the running web image.
- If a blueprint references a component not present in the web bundle, the shell shows a "requires rebuild" warning.

Implication:
- Blueprint-only customization works now.
- Net-new frontend component code requires publishing a new web image.

## Practical Rule for External Module Authors

Use this sequence:
1. Build module behavior with AME3 manifest/models/api/validators.
2. Implement UI using existing blueprint contracts and available UI primitives.
3. Request web image rebuild only when truly needing net-new frontend components.

## AI Assistant Prompt Starter

Use this instruction before generating module code:

> Read `AGENTS.md`, `docs/ai-context/ame3-modules.md`, and `docs/ai-context/ame3-runtime-capabilities.md` first.  
> Follow AME3 rules exactly.  
> Prefer blueprint-driven UI and existing runtime components/libraries.  
> Do not assume new React components are available unless a new web image build is part of the plan.

