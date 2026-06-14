# PWA Module Icon Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make module PWAs use the same module logo shown by Atlas and force the correct manifest identity to be loaded before users install another module.

**Architecture:** The API will resolve `manifest.logoUrl` from the existing canonical `apps/desktop/public/module-logos` catalog and include the asset bytes in the PWA identity hash, falling back to Lucide only when no logo is configured. The early bootstrap script will expose the module identity selected during the initial document load, while the install controller will reload a stale SPA route with a temporary install marker before showing browser or iOS installation instructions.

**Tech Stack:** Node.js, Hono, React, Vite, Lucide, Sharp, Node `node:test`

---

## File Structure

- Create `apps/api/src/routes/pwa-icon-source.js`: safely resolve local module logo assets and compute their content hash.
- Modify `apps/api/src/routes/pwa.js`: use the shared logo source for manifests, ETags and PNG rendering.
- Modify `apps/api/src/routes/__tests__/pwa.test.js`: verify Calendar logo rendering, hash changes and unsafe path rejection.
- Modify `infra/docker/api.Dockerfile`: include the canonical module-logo catalog in the API image.
- Modify `apps/desktop/public/pwa-bootstrap.js`: expose the immutable initial manifest identity and install marker.
- Modify `apps/desktop/src/lib/__tests__/pwa-bootstrap.test.js`: verify bootstrap identity and marker parsing.
- Modify `apps/desktop/src/hooks/usePwaInstall.js`: prepare a full document reload when the active SPA module differs from the initial manifest.
- Modify `apps/desktop/src/hooks/__tests__/pwa-install-controller.test.js`: verify reload, manual readiness and marker cleanup behavior.
- Modify `apps/desktop/src/app/AtlasApp.jsx`: pass manual installation state to the shell.
- Modify `apps/desktop/src/components/Topbar.jsx`: forward module installation state to `UserMenu`.
- Modify `apps/desktop/src/components/UserMenu.jsx`: require an explicit “Preparar este módulo” action on iOS before showing Share instructions.

### Task 1: Render Canonical Module Logos

**Files:**
- Create: `apps/api/src/routes/pwa-icon-source.js`
- Modify: `apps/api/src/routes/pwa.js`
- Modify: `apps/api/src/routes/__tests__/pwa.test.js`
- Modify: `infra/docker/api.Dockerfile`

- [ ] **Step 1: Write failing API tests**

Add a Calendar fixture with:

```js
logoUrl: '/module-logos/atlas-calendar-128.svg'
```

Then assert:

```js
test('renders configured module logos instead of the Lucide fallback', async () => {
  const response = await createApp().request(
    'https://atlas.example.com/pwa/icon/atlas.calendar/192.png',
  )
  const buffer = Buffer.from(await response.arrayBuffer())
  const expected = await sharp(calendarLogoBuffer)
    .resize(192, 192)
    .png()
    .toBuffer()

  assert.equal(response.status, 200)
  assert.deepEqual(buffer, expected)
})
```

Load `calendarLogoBuffer` from `apps/desktop/public/module-logos/atlas-calendar-128.svg`. Add tests proving an external `logoUrl` returns `404` and that changing injected logo bytes changes the manifest icon version.

- [ ] **Step 2: Run API tests and verify RED**

Run:

```bash
node --test apps/api/src/routes/__tests__/pwa.test.js
```

Expected: Calendar rendering/hash tests fail because `pwa.js` ignores `logoUrl`; unsafe path test fails because no logo-path validation exists.

- [ ] **Step 3: Add the safe logo-source resolver**

Create `pwa-icon-source.js` with an injected catalog directory for tests:

```js
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_MODULE_LOGO_DIR = fileURLToPath(
  new URL('../../../desktop/public/module-logos/', import.meta.url),
)

export async function loadModuleLogo(logoUrl, {
  logoDirectory = DEFAULT_MODULE_LOGO_DIR,
  readAsset = readFile,
} = {}) {
  if (!logoUrl) return null
  if (!logoUrl.startsWith('/module-logos/')) return { invalid: true }

  const relativePath = logoUrl.slice('/module-logos/'.length)
  if (!relativePath || relativePath !== path.basename(relativePath)) {
    return { invalid: true }
  }

  try {
    const buffer = await readAsset(path.join(logoDirectory, relativePath))
    return {
      buffer,
      hash: createHash('sha256').update(buffer).digest('hex'),
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Use logo bytes in PWA identity and rendering**

Change `hashIdentity` to receive `logoHash`, include `logoUrl` and `logoHash`, and resolve the logo before producing a manifest or icon. When `loadModuleLogo()` returns `{ invalid: true }`, respond `404`. When it returns a buffer, pass that buffer directly to `sharp`; otherwise retain the current Lucide SVG generation.

Expose dependency injection from the router:

```js
export function createPwaRouter({
  prisma,
  loadLogo = loadModuleLogo,
}) {
```

This allows tests to change logo bytes without modifying filesystem assets.

- [ ] **Step 5: Include logos in the API image**

Add after `COPY apps/api apps/api`:

```dockerfile
COPY apps/desktop/public/module-logos apps/desktop/public/module-logos
```

- [ ] **Step 6: Run API tests and verify GREEN**

Run:

```bash
node --test apps/api/src/routes/__tests__/pwa.test.js
```

Expected: all PWA route tests pass.

- [ ] **Step 7: Commit canonical icon support**

```bash
git add apps/api/src/routes/pwa-icon-source.js apps/api/src/routes/pwa.js apps/api/src/routes/__tests__/pwa.test.js infra/docker/api.Dockerfile
git commit -m "fix(pwa): render canonical module logos"
```

### Task 2: Preserve Initial Manifest Identity

**Files:**
- Modify: `apps/desktop/public/pwa-bootstrap.js`
- Modify: `apps/desktop/src/lib/__tests__/pwa-bootstrap.test.js`
- Modify: `apps/desktop/src/hooks/usePwaInstall.js`
- Modify: `apps/desktop/src/hooks/__tests__/pwa-install-controller.test.js`

- [ ] **Step 1: Write failing bootstrap and controller tests**

Extend the bootstrap VM location with `search` and assert:

```js
assert.deepEqual(window.__ATLAS_PWA_BOOTSTRAP__, {
  moduleKey: 'atlas.calendar',
  installRequested: true,
})
```

Add controller tests for:

```js
const controller = createPwaInstallController({
  moduleKey: 'atlas.calendar',
  documentModuleKey: 'atlas.projects',
  onAvailabilityChange() {},
  onManualReadyChange() {},
  navigateForInstall: (url) => navigations.push(url),
  currentUrl: 'https://atlas.example.com/app/m/atlas.calendar/calendar?view=month#today',
})

await controller.install()

assert.equal(
  navigations[0],
  'https://atlas.example.com/app/m/atlas.calendar/calendar?view=month&pwa-install=1#today',
)
```

Also assert that a matching document identity returns a manual-install result without navigation.

- [ ] **Step 2: Run frontend unit tests and verify RED**

Run:

```bash
node --test apps/desktop/src/lib/__tests__/pwa-bootstrap.test.js apps/desktop/src/hooks/__tests__/pwa-install-controller.test.js
```

Expected: tests fail because bootstrap metadata and reload preparation do not exist.

- [ ] **Step 3: Expose immutable bootstrap metadata**

In `pwa-bootstrap.js`, parse `window.location.search` and assign:

```js
window.__ATLAS_PWA_BOOTSTRAP__ = {
  moduleKey: moduleKey,
  installRequested:
    new URLSearchParams(window.location.search || "").get("pwa-install") === "1",
}
```

Do not update this object from React; it represents only the manifest selected before React started.

- [ ] **Step 4: Add install URL and marker helpers**

In `usePwaInstall.js`, export:

```js
export function createPwaInstallReloadUrl(currentUrl) {
  const url = new URL(currentUrl)
  url.searchParams.set("pwa-install", "1")
  return url.toString()
}

export function clearPwaInstallMarker(currentUrl) {
  const url = new URL(currentUrl)
  url.searchParams.delete("pwa-install")
  return `${url.pathname}${url.search}${url.hash}`
}
```

- [ ] **Step 5: Reload stale identities and expose manual readiness**

Extend the controller with `documentModuleKey`, `navigateForInstall`, `currentUrl`, and `onManualReadyChange`. Its `install()` method must:

1. Return `null` without an active module.
2. Navigate to `createPwaInstallReloadUrl(currentUrl)` when `documentModuleKey !== activeModuleKey`.
3. Prompt normally when a matching deferred prompt exists.
4. Otherwise mark manual installation ready and return `{ outcome: "manual" }`.

Initialize the hook from `window.__ATLAS_PWA_BOOTSTRAP__`. If `installRequested` matches the active module, set manual readiness and remove only `pwa-install` with `history.replaceState`.

- [ ] **Step 6: Run frontend unit tests and verify GREEN**

Run:

```bash
node --test apps/desktop/src/lib/__tests__/pwa-bootstrap.test.js apps/desktop/src/hooks/__tests__/pwa-install-controller.test.js
```

Expected: all bootstrap and install-controller tests pass.

- [ ] **Step 7: Commit identity handoff**

```bash
git add apps/desktop/public/pwa-bootstrap.js apps/desktop/src/lib/__tests__/pwa-bootstrap.test.js apps/desktop/src/hooks/usePwaInstall.js apps/desktop/src/hooks/__tests__/pwa-install-controller.test.js
git commit -m "fix(pwa): reload before installing another module"
```

### Task 3: Guide iOS Through Prepared Installation

**Files:**
- Modify: `apps/desktop/src/app/AtlasApp.jsx`
- Modify: `apps/desktop/src/components/Topbar.jsx`
- Modify: `apps/desktop/src/components/UserMenu.jsx`

- [ ] **Step 1: Connect manual readiness to the shell**

Read:

```js
const { canInstall, install, manualInstallReady } =
  usePwaInstall(moduleKeyFromPath)
```

Pass `manualInstallReady` and `activeModuleKey` through `Topbar` to `UserMenu`.

- [ ] **Step 2: Require preparation before iOS Share instructions**

For iOS with an active module:

- When `manualInstallReady` is false, render a primary button labeled `Preparar este módulo` that calls `onInstall`.
- When true, render the existing Safari Share instruction.
- Outside a module route, do not show module PWA installation instructions.

Android retains the native prompt when available and uses the same preparation button when a prompt is not currently available.

- [ ] **Step 3: Build the frontend**

Run:

```bash
pnpm --filter @atlas/desktop build:web
```

Expected: Vite build completes successfully.

- [ ] **Step 4: Run React Doctor**

Browser plugin is not available in this session, so use the repository scanner:

```bash
npx -y react-doctor@latest apps/desktop --verbose --diff
```

Expected: no new errors attributable to the modified components.

- [ ] **Step 5: Commit iOS installation guidance**

```bash
git add apps/desktop/src/app/AtlasApp.jsx apps/desktop/src/components/Topbar.jsx apps/desktop/src/components/UserMenu.jsx
git commit -m "fix(pwa): prepare module identity on ios"
```

### Task 4: Full Verification

**Files:**
- Verify: `docs/superpowers/specs/2026-06-14-pwa-module-icon-consistency-design.md`

- [ ] **Step 1: Run focused PWA tests**

```bash
node --test apps/api/src/routes/__tests__/pwa.test.js apps/desktop/src/lib/__tests__/pwa-bootstrap.test.js apps/desktop/src/hooks/__tests__/pwa-install-controller.test.js
```

Expected: all tests pass.

- [ ] **Step 2: Run manifest identity tests**

```bash
node --test apps/api/src/manifests/official/__tests__/pwa-identities.test.js packages/module-engine/src/__tests__/define-module.test.js
```

Expected: all tests pass.

- [ ] **Step 3: Check repository cleanliness**

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors and `main` contains only intentional committed changes.
