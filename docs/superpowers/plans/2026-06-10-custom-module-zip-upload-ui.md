# Custom Module ZIP Upload — Plan B: UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Subir módulo" button to the module catalog header that opens a ZIP upload sheet, and a "Purgar módulo" destructive action inside the module detail sheet — both guarded by the new `core.modules.upload` / `core.modules.purge` permissions.

**Architecture:** `UploadModuleSheet.jsx` is a new file so `ModuleCatalog.jsx` (already 1716 lines) does not grow further. The purge action is a minimal addition (button + `ConfirmDialog`) inside the existing `SheetActions` component. Both features call the SDK methods added in Plan A.

**Tech Stack:** React 18, TanStack Query, sonner (toast), `@atlas/ui` (Sheet, Button, ConfirmDialog), Lucide icons, `@atlas/sdk` via `atlas` singleton.

**Requires:** Plan A must be merged and `pnpm db:seed` run so `core.modules.upload` and `core.modules.purge` exist in the DB.

**Spec:** `docs/superpowers/specs/2026-06-10-custom-module-zip-upload-design.md`

---

## File Structure Map

| Action | File | Responsibility |
|---|---|---|
| Create | `apps/desktop/src/modules/atlas.core/screens/UploadModuleSheet.jsx` | ZIP file picker, upload logic, loading/error state |
| Modify | `apps/desktop/src/modules/atlas.core/screens/ModuleCatalog.jsx` | Add permission check, header button, sheet state, purge button in SheetActions |

---

## Task 1: Create `UploadModuleSheet.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.core/screens/UploadModuleSheet.jsx`

This component is self-contained. It receives `open`, `onOpenChange`, and `onSuccess` props. It auto-detects the module key from the selected filename.

- [ ] **Step 1.1: Create the file**

```jsx
import { useState, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Input,
  Label,
} from "@atlas/ui";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

// Derives a candidate module key from a ZIP filename.
// "custom.musicfy.zip" → "custom.musicfy"
// "custom.musicfy-v2.1.zip" → "custom.musicfy" (strips version suffix)
function guessKeyFromFilename(filename) {
  const base = filename.replace(/\.zip$/i, "");
  // Accept only valid Atlas module key characters
  const match = base.match(/^([a-z][a-z0-9]*\.[a-z][a-z0-9._-]*)/);
  return match ? match[1] : base;
}

export function UploadModuleSheet({ open, onOpenChange, onSuccess }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [moduleKey, setModuleKey] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  function handleFileChange(e) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      setModuleKey(guessKeyFromFilename(selected.name));
    }
  }

  function handleClose(open) {
    if (!open) {
      setFile(null);
      setModuleKey("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    onOpenChange(open);
  }

  async function handleUpload() {
    if (!file || !moduleKey.trim() || !token) return;

    const key = moduleKey.trim();
    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    const toastId = toast.loading(`Subiendo ${key}...`);

    try {
      const result = await atlas.modules.uploadModuleZip(key, formData, token);
      if (result?.error) {
        toast.error(result.error, { id: toastId, description: JSON.stringify(result.details ?? "") });
        return;
      }
      toast.success(`Módulo ${key} subido correctamente`, {
        id: toastId,
        description: `${result?.data?.fileCount ?? "?"} archivos extraídos. Sincronizando catálogo...`,
      });
      handleClose(false);
      onSuccess?.();
    } catch (err) {
      toast.error("Error al subir el módulo", {
        id: toastId,
        description: err?.message ?? "Error desconocido",
      });
    } finally {
      setIsUploading(false);
    }
  }

  const canSubmit = Boolean(file && moduleKey.trim() && token && !isUploading);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Subir módulo</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Sube un archivo ZIP con el código de tu módulo custom. El módulo se
            extraerá al servidor y quedará disponible para instalar desde el catálogo.
          </p>

          {/* File picker */}
          <div className="space-y-2">
            <Label htmlFor="module-zip-file">Archivo ZIP</Label>
            <input
              ref={fileInputRef}
              id="module-zip-file"
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              disabled={isUploading}
              className="block w-full text-sm text-[hsl(var(--foreground))] file:mr-3 file:rounded-md file:border file:border-[hsl(var(--border))] file:bg-[hsl(var(--muted))] file:px-3 file:py-1.5 file:text-xs file:font-medium file:cursor-pointer cursor-pointer"
            />
            {file && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          {/* Module key (auto-filled, editable) */}
          <div className="space-y-2">
            <Label htmlFor="module-key">Clave del módulo</Label>
            <Input
              id="module-key"
              value={moduleKey}
              onChange={(e) => setModuleKey(e.target.value)}
              placeholder="custom.mi-modulo"
              disabled={isUploading}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Debe coincidir con el campo <code>key</code> en{" "}
              <code>module.manifest.js</code>.
            </p>
          </div>

          <Button
            className="w-full bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            disabled={!canSubmit}
            onClick={handleUpload}
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Subiendo..." : "Subir módulo"}
          </Button>

          {/* Security note */}
          <p className="text-xs text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded-lg px-3 py-2">
            El ZIP se extrae directamente en el servidor. Solo sube módulos de
            fuentes de confianza.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 1.2: Syntax-check**

```bash
node --check apps/desktop/src/modules/atlas.core/screens/UploadModuleSheet.jsx
```

Expected: no output.

- [ ] **Step 1.3: Commit**

```bash
git add apps/desktop/src/modules/atlas.core/screens/UploadModuleSheet.jsx
git commit -m "feat(module-upload): add UploadModuleSheet component"
```

---

## Task 2: Wire upload button into ModuleCatalog header

**Files:**
- Modify: `apps/desktop/src/modules/atlas.core/screens/ModuleCatalog.jsx`

Three minimal edits to `ModuleCatalog.jsx`:
1. Import `UploadModuleSheet`
2. Add two lines of state + permission check
3. Add button to `PageHeader` `actions` + render the sheet

- [ ] **Step 2.1: Add import**

At the top of `ModuleCatalog.jsx`, after the existing local imports (around line 57-60), add:

```jsx
import { UploadModuleSheet } from "./UploadModuleSheet";
```

- [ ] **Step 2.2: Add permission check and state**

In `ModuleCatalogScreen` (the main component function), find the block where `canReadModules`, `canInstallModules`, etc. are declared (around line 387-390). Add after them:

```jsx
const canUploadModules = hasPermission("core.modules.upload");
const canPurgeModules = hasPermission("core.modules.purge");
```

Then, near the other `useState` calls in the component (look for `selectedModule` around line 409), add:

```jsx
const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
```

- [ ] **Step 2.3: Add button to PageHeader and render the sheet**

Find the `PageHeader` `actions` prop (around line 980-999). It currently renders one `<Button>` (Sincronizar). Wrap the existing button and add the upload button in a flex div:

```jsx
actions={
  <div className="flex items-center gap-2">
    {canUploadModules && (
      <Button
        variant="outline"
        onClick={() => setUploadSheetOpen(true)}
      >
        <Upload className="h-4 w-4" />
        Subir módulo
      </Button>
    )}
    <Button
      variant="default"
      className="bg-(--brand-primary) text-(--brand-primary-foreground) hover:bg-(--brand-primary-hover) shadow-sm"
      disabled={syncCatalogMutation.isPending || !canReadModules || !token}
      onClick={() => syncCatalogMutation.mutate()}
    >
      <RefreshCw
        className={cn("h-4 w-4", syncCatalogMutation.isPending && "animate-spin")}
      />
      {syncCatalogMutation.isPending ? "Sincronizando..." : "Sincronizar módulos"}
    </Button>
  </div>
}
```

Then, at the very end of the returned JSX (before the last closing `</div>` or `</>` of the screen), add the sheet:

```jsx
<UploadModuleSheet
  open={uploadSheetOpen}
  onOpenChange={setUploadSheetOpen}
  onSuccess={() => syncCatalogMutation.mutate()}
/>
```

- [ ] **Step 2.4: Add `Upload` icon to the Lucide imports**

Check the existing Lucide import block in `ModuleCatalog.jsx` (around line 31-51). If `Upload` is not already there, add it:

```jsx
import {
  // ... existing icons ...
  Upload,
} from "lucide-react";
```

- [ ] **Step 2.5: Build check**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 2.6: Start dev and verify the button appears**

```bash
pnpm dev
```

Navigate to the module catalog. With a user that has `core.modules.upload`:
- The "Subir módulo" button appears in the header.
- Clicking it opens the sheet with a file picker and module key input.
- Selecting a file named `custom.musicfy.zip` auto-fills the key field as `custom.musicfy`.

With a user that lacks `core.modules.upload`: the button does not appear.

- [ ] **Step 2.7: Commit**

```bash
git add apps/desktop/src/modules/atlas.core/screens/ModuleCatalog.jsx
git commit -m "feat(module-upload): wire upload button into catalog header"
```

---

## Task 3: Purge action in module detail sheet

**Files:**
- Modify: `apps/desktop/src/modules/atlas.core/screens/ModuleCatalog.jsx`

The `SheetActions` function (defined inside `ModuleCatalogScreen`) already has module lifecycle buttons. Add the purge button at the bottom, inside a danger zone section, with a `ConfirmDialog`.

- [ ] **Step 3.1: Add `ConfirmDialog` to imports from `@atlas/ui`**

In the `@atlas/ui` import block (around line 4-30), add `ConfirmDialog`:

```jsx
import {
  // ... existing imports ...
  ConfirmDialog,
} from "@atlas/ui";
```

- [ ] **Step 3.2: Add purge state and logic inside `SheetActions`**

Inside the `SheetActions({ module })` function body, after the existing `const` declarations (before `return`), add:

```jsx
const canPurge =
  canPurgeModules &&
  (module.status === "UNINSTALLED" || module.status === "DISABLED") &&
  !module.core;

const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
const [isPurging, setIsPurging] = useState(false);

async function handlePurge() {
  if (!token) return;
  setIsPurging(true);
  const toastId = toast.loading(`Purgando ${module.name}...`);
  try {
    const result = await atlas.modules.purgeModule(module.key, token);
    if (result?.error) {
      toast.error(result.error, { id: toastId });
      return;
    }
    toast.success(`Módulo ${module.name} eliminado del servidor`, { id: toastId });
    setSelectedModule(null);
    queryClient.invalidateQueries({ queryKey: ["modules"] });
  } catch (err) {
    toast.error("Error al purgar el módulo", {
      id: toastId,
      description: err?.message ?? "Error desconocido",
    });
  } finally {
    setIsPurging(false);
    setPurgeDialogOpen(false);
  }
}
```

> **Note:** `canPurgeModules`, `token`, `setSelectedModule`, and `queryClient` are available from the parent `ModuleCatalogScreen` closure — they do not need to be passed as props. `atlas` is also available from the module scope. Verify these are in scope before adding.

- [ ] **Step 3.3: Add purge button and ConfirmDialog to `SheetActions` return JSX**

At the end of `SheetActions`'s returned `<div className="space-y-2">`, after all existing buttons, add:

```jsx
{canPurge && (
  <>
    <div className="border-t border-[hsl(var(--border))] pt-3 mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">
        Zona de peligro
      </p>
      <Button
        variant="outline"
        className="w-full border-red-500/50 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
        disabled={isPurging || inFlight}
        onClick={() => setPurgeDialogOpen(true)}
      >
        Eliminar módulo del servidor
      </Button>
    </div>

    <ConfirmDialog
      open={purgeDialogOpen}
      onOpenChange={setPurgeDialogOpen}
      title="Eliminar módulo del servidor"
      description={`Esta acción elimina permanentemente todos los archivos de "${module.name}" del servidor y su registro en la base de datos. No se puede deshacer.`}
      confirmLabel="Eliminar permanentemente"
      cancelLabel="Cancelar"
      destructive
      onConfirm={handlePurge}
    />
  </>
)}
```

- [ ] **Step 3.4: Build check**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 3.5: Manual verification of purge flow**

Start the dev server (`pnpm dev`). With an UNINSTALLED custom module visible in the catalog:

1. Click the module card to open the detail sheet.
2. Scroll to "Zona de peligro" — the "Eliminar módulo del servidor" button appears.
3. Click it — `ConfirmDialog` opens with the warning text.
4. Click "Cancelar" — dialog closes, nothing happens.
5. Click the button again, then "Eliminar permanentemente" — loading toast appears, then success toast. Sheet closes. Module disappears from the catalog list.

With an INSTALLED+enabled module: the purge button does NOT appear (hidden by `canPurge` check).

With a user lacking `core.modules.purge`: the purge button does NOT appear.

- [ ] **Step 3.6: Commit**

```bash
git add apps/desktop/src/modules/atlas.core/screens/ModuleCatalog.jsx
git commit -m "feat(module-upload): add purge action to module detail sheet"
```

---

## Task 4: End-to-end QA checklist

This task has no code — it is a manual verification pass before marking Plan B complete.

- [ ] **4.1 Upload happy path**
  - Set `ATLAS_MODULES_DIR` in `.env` to a temp directory.
  - Log in as a user with `core.modules.upload`.
  - Click "Subir módulo" in the catalog header.
  - Select a valid ZIP of `custom.musicfy` (or any custom module from the installer).
  - Verify key auto-fills as `custom.musicfy`.
  - Click "Subir módulo" → loading toast appears → success toast → catalog refreshes.
  - Verify files appeared in the temp directory at `{ATLAS_MODULES_DIR}/custom.musicfy/`.

- [ ] **4.2 Upload validation — missing manifest**
  - Create a ZIP without `module.manifest.js`.
  - Upload → error toast shows `MISSING_MANIFEST`.

- [ ] **4.3 Upload validation — key mismatch**
  - Upload a ZIP where manifest key is `custom.other` but key field says `custom.musicfy`.
  - Error toast shows `MANIFEST_KEY_MISMATCH`.

- [ ] **4.4 Upload — no permission**
  - Log in as a user without `core.modules.upload`.
  - Verify the "Subir módulo" button does not appear in the header.

- [ ] **4.5 Purge happy path**
  - Ensure `custom.musicfy` is in UNINSTALLED status.
  - Open its detail sheet → "Zona de peligro" section visible.
  - Click "Eliminar módulo del servidor" → ConfirmDialog appears.
  - Click "Eliminar permanentemente" → success toast → sheet closes → module gone from catalog.
  - Verify `{ATLAS_MODULES_DIR}/custom.musicfy/` directory no longer exists.

- [ ] **4.6 Purge blocked on INSTALLED module**
  - With `custom.fleet` INSTALLED+enabled: open detail sheet → no "Zona de peligro" section.

- [ ] **4.7 Purge — no permission**
  - Log in as user without `core.modules.purge` → purge section not visible.

- [ ] **4.8 MODULES_DIR not configured**
  - Unset `ATLAS_MODULES_DIR`, restart API.
  - Try uploading → error toast shows `MODULES_DIR_NOT_CONFIGURED`.

- [ ] **4.9 Commit final QA pass marker**

```bash
git commit --allow-empty -m "chore: Plan B QA pass complete — module ZIP upload UI verified"
```

---

## Installer note (out of scope for this plan — separate task)

The installer repository (`ATLASERP-INSTALLER`) `setup-local.mjs` and `setup-external.mjs` must write `ATLAS_MODULES_DIR` to the generated `.env`. The expected value is the container-side path where `custom-modules/` is volume-mounted (e.g., `/app/modules/custom`). This is a separate change tracked outside this plan.

For **Mac/Linux** setups using `setup-local.sh`, add the same env var to the shell script's `.env` generation block.

For **Windows** setups using `setup-local.mjs`, the Node.js script already handles cross-platform paths — just ensure the value uses forward slashes or let `path.resolve()` normalize it at runtime.

---

## Spec Coverage Verification

| Spec requirement | Covered by |
|---|---|
| "Subir módulo" button — visible to `core.modules.upload` only | Task 2 (`canUploadModules` guard on button) |
| Sheet with file input + key field | Task 1 (`UploadModuleSheet.jsx`) |
| Auto-detect key from filename | Task 1 (`guessKeyFromFilename`) |
| Loading toast during upload | Task 1 (`toast.loading`) |
| Success toast + catalog refresh | Task 1 (`onSuccess?.()` → `syncCatalogMutation.mutate()`) |
| Error toast with server message | Task 1 (error branch in `handleUpload`) |
| Purge button only for UNINSTALLED/DISABLED + non-core | Task 3 (`canPurge` check) |
| `ConfirmDialog` before purge | Task 3 |
| Purge success: sheet closes + catalog refresh | Task 3 (`setSelectedModule(null)` + `queryClient.invalidateQueries`) |
| All UI labels in Spanish | All tasks (verified labels: "Subir módulo", "Zona de peligro", "Eliminar módulo del servidor", "Eliminar permanentemente", etc.) |
