# AME3 Package Resolution Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link `@atlas/module-engine` through workspace dependencies so AME3 local module files (for example `custom.fleet`) resolve imports naturally without runtime rewriting.

**Architecture:** Dependency-level fix only. Preserve current discovery import/path safety and metadata/lifecycle behavior.

**Tech Stack:** pnpm workspaces, ESM import resolution, existing AME3 discovery service.

---

## File Structure Map

### Files to modify

1. `package.json`  
Changes:
- add root dependency entry:
  - `"@atlas/module-engine": "workspace:*"`

2. `pnpm-lock.yaml`  
Changes:
- updated by `pnpm.cmd install` to reflect workspace dependency graph.

### Files to create

- None.

### Files forbidden to modify

- `apps/api/src/services/module-discovery-service.js`
- `apps/api/src/routes/modules.js`
- `modules/custom/custom.fleet/**`
- `modules/custom/**/package.json` (must not be created)
- `packages/module-engine/**`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `apps/desktop/**`
- `packages/maps/**`

---

## Task 1: Add Workspace Dependency

**Files:**
- Modify: `package.json`

- [ ] **1.1 Add `@atlas/module-engine` as root dependency with `workspace:*`**
- [ ] **1.2 Do not add module-local package manifests**

Validation commands:

```bash
node -e "const p=require('./package.json'); console.log(p.dependencies?.['@atlas/module-engine'] ?? null)"
```

Expected output:
- prints `workspace:*`

Commit checkpoint:

```bash
git add package.json
git commit -m "chore(ame3): link @atlas/module-engine as workspace dependency"
```

---

## Task 2: Regenerate Workspace Lockfile

**Files:**
- Modify: `pnpm-lock.yaml`

- [ ] **2.1 Run workspace install**
- [ ] **2.2 Confirm lockfile reflects added workspace dependency**

Validation commands:

```bash
pnpm.cmd install
```

Expected output:
- install completes successfully
- lockfile updates are present and deterministic

Commit checkpoint:

```bash
git add pnpm-lock.yaml
git commit -m "chore(ame3): update lockfile for module-engine workspace link"
```

---

## Task 3: Resolution Verification

**Files:**
- No new files expected

- [ ] **3.1 Verify `@atlas/module-engine` import resolves**
- [ ] **3.2 Verify `custom.fleet` manifest import resolves naturally**
- [ ] **3.3 Verify discovery marks `custom.fleet` as `VALID`**

Validation commands:

```bash
node -e "import('@atlas/module-engine').then(m => console.log(Object.keys(m)))"
node -e "import('./modules/custom/custom.fleet/module.manifest.js').then(m => console.log(m.default.key))"
node -e "import('./apps/api/src/services/module-discovery-service.js').then(async (m) => { const records = await m.discoverModules({ rootDir: process.cwd() }); const fleet = records.find((r) => r.key === 'custom.fleet'); console.log(JSON.stringify({ found: Boolean(fleet), status: fleet?.status ?? null, errorCode: fleet?.error?.code ?? null }, null, 2)); })"
```

Expected output:
- `@atlas/module-engine` import succeeds
- manifest import prints `custom.fleet`
- discovery prints `status: "VALID"` for `custom.fleet`

Commit checkpoint:

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(ame3): enable safe module-engine resolution for local module declarations"
```

---

## Full Validation

Run after Task 3:

```bash
pnpm.cmd install
node -e "import('@atlas/module-engine').then(m => console.log(Object.keys(m)))"
node -e "import('./modules/custom/custom.fleet/module.manifest.js').then(m => console.log(m.default.key))"
node -e "import('./apps/api/src/services/module-discovery-service.js').then(async (m) => { const records = await m.discoverModules({ rootDir: process.cwd() }); const fleet = records.find((r) => r.key === 'custom.fleet'); console.log(JSON.stringify({ found: Boolean(fleet), status: fleet?.status ?? null, errorCode: fleet?.error?.code ?? null }, null, 2)); })"
git status --short
```

Expected output:
- all import checks pass
- `custom.fleet` discovery is `VALID`
- only `package.json` and `pnpm-lock.yaml` changed

---

## Expected Outputs (Summary)

1. Workspace dependency link exists for `@atlas/module-engine`.
2. Local module declaration imports resolve without runtime rewriting.
3. Discovery safety behavior remains unchanged.
4. `custom.fleet` transitions from package-resolution `ERROR` to `VALID`.

