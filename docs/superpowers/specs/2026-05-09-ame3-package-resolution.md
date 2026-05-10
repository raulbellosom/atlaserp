# AME3 Package Resolution Linking

Date: 2026-05-09  
Status: Draft  
Owner: Atlas ERP AME3

---

## Problem

AME3 module discovery now enforces strict import safety:
- no `data:` URL imports
- no source rewriting
- no eval-like fallback

That is correct, but `modules/custom/custom.fleet/module.manifest.js` currently fails to import because `@atlas/module-engine` is not resolvable from local module files under `modules/custom/**`.

As a result:
- discovery is safe but returns `ERROR` for `custom.fleet`
- `/modules/sync` cannot persist valid metadata for that module

---

## Goals

1. Make `@atlas/module-engine` resolvable by local AME3 module files (manifest/model/view/page files).
2. Keep current discovery import safety unchanged.
3. Use workspace-native dependency linking (`workspace:*`) instead of runtime import hacks.
4. Keep `modules/custom/custom.fleet` as a plain module folder (not a workspace package).

---

## Non-goals

1. No `data:` URL, source rewriting, eval, or generated-code import fallback.
2. No changes to module discovery path-safety/import-safety logic.
3. No changes to `modules/custom/custom.fleet/**` structure.
4. No new `package.json` inside custom module folders.
5. No migration/schema/API behavior changes in this phase.

---

## Architecture impact

This phase is dependency wiring only.

Runtime effect:
- Node module resolution from `modules/custom/**` can resolve `@atlas/module-engine` through workspace-linked `node_modules`.
- Discovery can import module declaration files naturally with standard ESM resolution.

No behavior change in:
- discovery security boundaries
- metadata sync semantics
- lifecycle/install/uninstall logic

---

## Package resolution strategy

Preferred strategy:
1. Add `@atlas/module-engine` to root `package.json` dependencies using:
   - `"@atlas/module-engine": "workspace:*"`
2. Run `pnpm.cmd install` to materialize workspace links and update lockfile.
3. Keep module declaration imports as:
   - `import { defineAtlasModule } from '@atlas/module-engine'`
   - `import { defineModel } from '@atlas/module-engine'`
   - `import { defineView } from '@atlas/module-engine'`
   - `import { definePage } from '@atlas/module-engine'`

Rationale:
- keeps module files clean and portable within repository conventions
- avoids unsafe runtime rewriting
- aligns with monorepo dependency management

---

## Workspace impact

Expected file changes:
- root `package.json` (dependency entry)
- `pnpm-lock.yaml` (lockfile update)

No workspace expansion:
- do not convert `modules/custom/custom.fleet` to a workspace package
- do not add `package.json` files under `modules/custom/**`

---

## Security considerations

1. Preserve strict import safety:
- discovery imports only validated local files
- no dynamic source transformation

2. Preserve trust boundary:
- package resolution is solved at install/link time, not runtime mutation.

3. Preserve deterministic behavior:
- failures remain explicit (`MANIFEST_IMPORT_FAILED`) if linking is broken.

---

## Validation commands

```bash
# 1) Install/link workspace dependencies
pnpm.cmd install

# 2) Confirm module-engine package resolves from workspace
node -e "import('@atlas/module-engine').then(m => console.log(Object.keys(m)))"

# 3) Confirm module manifest import resolves naturally
node -e "import('./modules/custom/custom.fleet/module.manifest.js').then(m => console.log(m.default.key))"

# 4) Discovery smoke: custom.fleet must be VALID
node -e "import('./apps/api/src/services/module-discovery-service.js').then(async (m) => { const records = await m.discoverModules({ rootDir: process.cwd() }); const fleet = records.find((r) => r.key === 'custom.fleet'); console.log(JSON.stringify({ found: Boolean(fleet), status: fleet?.status ?? null, errorCode: fleet?.error?.code ?? null }, null, 2)); })"
```

Expected high-level results:
- workspace install completes successfully
- `@atlas/module-engine` is importable directly
- `custom.fleet` manifest imports without package resolution error
- discovery reports `custom.fleet` as `VALID`

---

## Acceptance criteria

1. Root `package.json` includes `@atlas/module-engine: workspace:*`.
2. `pnpm-lock.yaml` is updated by `pnpm.cmd install`.
3. No `data:` URL or import rewrite fallback is introduced.
4. No `package.json` is added inside `modules/custom/custom.fleet`.
5. `import('@atlas/module-engine')` succeeds.
6. `import('./modules/custom/custom.fleet/module.manifest.js')` succeeds and returns key `custom.fleet`.
7. `discoverModules({ rootDir: process.cwd() })` includes `custom.fleet` with `status: "VALID"`.
8. No changes outside this phase’s dependency-linking scope.

