# atlas.pfm — Phase 3 — Plan B (Desktop UI: Tickets capture + review) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **Tickets** screen — upload a receipt photo (camera on mobile), see a thumbnail grid with live status (Procesando / Listo para revisar / Error / Registrado), and open a prefilled movement form for a parsed receipt to confirm it into a `POSTED` movement.

**Architecture:** Continues Phase 2 UI. New hooks over the SDK `atlas.pfm` receipt methods, including a polling `useReceipt` that stops once the receipt leaves `PROCESSING`. `ReceiptsScreen` uses `@atlas/ui` `ImageUploader`/`FileUploader` for the upload control and `AttachmentsPanel`-style thumbnails; `ReceiptReviewSheet` reuses the `QuickAddMovementSheet` field set but seeds it from `receipt.parsed` and calls `confirmReceipt` instead of `createMovement`. Registered in `ModuleOutlet.jsx` (`atlas.pfm:/receipts`). `@atlas/ui` only, `ConfirmDialog` where needed.

**Tech Stack:** React 18, TanStack Query v5, React Hook Form + Zod, `@atlas/ui`, lucide-react, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-31-atlas-pfm-design.md` (section 9 — Tickets; 6.1 steps 3-6). **Prereq:** Phase 3 Plan A merged; API running (receipt endpoints return 503 without `GROQ_API_KEY` — the screen shows that state).

**QA gate:** screenshot Tickets (empty, uploading, parsed grid, review sheet) at **390px** and **1440px**; 14-aspect checklist. Carried on the PFM-5 backlog item if the Playwright bridge is unavailable.

---

## File Structure

- `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js` — `useReceipts`, `useReceipt` (polling), `useUploadReceipt`, `useConfirmReceipt`, `useRetryReceipt` (modify).
- `apps/desktop/src/modules/atlas.pfm/lib/receipt-image.js` — `useReceiptImageUrl(fileId)` via the files SDK signed URL (create).
- `apps/desktop/src/modules/atlas.pfm/components/ReceiptReviewSheet.jsx` — prefilled confirm form (create).
- `apps/desktop/src/modules/atlas.pfm/screens/ReceiptsScreen.jsx` — upload + grid (create).
- `apps/desktop/src/app/ModuleOutlet.jsx` — register `atlas.pfm:/receipts` (modify).

---

## Task 1: Hooks

**Files:** `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js` (modify)

- [ ] **Step 1: Query hooks** (near `useUpcoming`):

```js
export function useReceipts() {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "receipts"],
    queryFn: () => atlas.pfm.listReceipts(token),
    enabled: Boolean(token),
    select: (res) => res.data ?? [],
    // While any receipt is still processing, refetch the list every 4s.
    refetchInterval: (query) =>
      (query.state.data?.data ?? []).some((r) => r.status === "PROCESSING") ? 4000 : false,
  });
}

export function useReceipt(receiptId, { poll = true } = {}) {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "receipt", receiptId],
    queryFn: () => atlas.pfm.getReceipt(receiptId, token),
    enabled: Boolean(token && receiptId),
    select: (res) => res.data ?? null,
    refetchInterval: (query) =>
      poll && query.state.data?.data?.status === "PROCESSING" ? 3000 : false,
  });
}
```

- [ ] **Step 2: Mutation hooks** (near `useCreateRecurringRule`):

```js
export function useUploadReceipt() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return atlas.pfm.uploadReceipt(fd, token);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pfm", "receipts"] }),
  });
}

export function useConfirmReceipt() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pfm.confirmReceipt(id, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useRetryReceipt() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => atlas.pfm.retryReceipt(id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pfm", "receipts"] }),
  });
}
```

- [ ] **Step 3** — `node --check apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js`.
- [ ] **Step 4** — `git add apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js && git commit -m "feat(pfm-ui): receipt hooks with processing poll"`

---

## Task 2: `receipt-image.js`

**Files:** `apps/desktop/src/modules/atlas.pfm/lib/receipt-image.js` (create)

- [ ] **Step 1: Check the files SDK signed-url method name** — `grep -n "signedUrl\|getSignedUrl\|files:\s*{" packages/sdk/src/index.js`. Use whatever the `files` group exposes (likely `files.signedUrl(id, token)` or `files.getSignedUrl`). Then:

```js
// apps/desktop/src/modules/atlas.pfm/lib/receipt-image.js
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// Resolve a private atlas.files asset to a short-lived signed URL for <img>.
export function useReceiptImageUrl(fileId) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useQuery({
    queryKey: ["pfm", "receipt-image", fileId],
    queryFn: async () => {
      const res = await atlas.files.signedUrl(fileId, token); // adjust to the real method
      return res?.data?.signedUrl ?? res?.signedUrl ?? res?.url ?? null;
    },
    enabled: Boolean(token && fileId),
    staleTime: 45 * 60 * 1000,
  });
}
```

- [ ] **Step 2** — `git add apps/desktop/src/modules/atlas.pfm/lib/receipt-image.js && git commit -m "feat(pfm-ui): signed-url hook for receipt thumbnails"`

---

## Task 3: `ReceiptReviewSheet.jsx`

**Files:** `apps/desktop/src/modules/atlas.pfm/components/ReceiptReviewSheet.jsx` (create)

- [ ] **Step 1: Write the component**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/ReceiptReviewSheet.jsx
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Button,
  TextField,
  SelectField,
  ComboboxField,
  DateField,
} from "@atlas/ui";
import { useWallets, usePfmCategories, useConfirmReceipt } from "../hooks/use-pfm-queries";
import { useReceiptImageUrl } from "../lib/receipt-image";
import { todayIso } from "../lib/format";

const schema = z.object({
  walletId: z.string().uuid("Elige una cartera"),
  direction: z.enum(["EXPENSE", "INCOME"]),
  amount: z.coerce.number().positive("Ingresa el monto"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha"),
  merchant: z.string().max(160).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export function ReceiptReviewSheet({ open, onOpenChange, receipt }) {
  const parsed = receipt?.parsed ?? {};
  const { data: wallets = [] } = useWallets();
  const [direction, setDirection] = useState("EXPENSE");
  const { data: categories = [] } = usePfmCategories(direction);
  const confirmMut = useConfirmReceipt();
  const { data: imageUrl } = useReceiptImageUrl(receipt?.fileId);
  const [categoryId, setCategoryId] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      walletId: "",
      direction: "EXPENSE",
      amount: "",
      occurredOn: todayIso(),
      merchant: "",
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      walletId: wallets[0]?.id ?? "",
      direction: "EXPENSE",
      amount: parsed.total ?? "",
      occurredOn: parsed.date ?? todayIso(),
      merchant: parsed.merchant ?? "",
      note: "",
    });
    setDirection("EXPENSE");
    setCategoryId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, receipt?.id]);

  const walletOptions = wallets.map((w) => ({ value: w.id, label: `${w.name} (${w.currency})` }));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  async function onSubmit(v) {
    await confirmMut.mutateAsync({
      id: receipt.id,
      walletId: v.walletId,
      direction: v.direction,
      amount: Number(v.amount),
      occurredOn: v.occurredOn,
      categoryId: categoryId || null,
      merchant: v.merchant || null,
      note: v.note || null,
    });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Revisar ticket</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Ticket"
              className="max-h-48 w-full rounded-xl object-contain bg-[hsl(var(--muted))]"
            />
          )}
          <TextField
            label="Monto"
            type="number"
            step="0.01"
            inputMode="decimal"
            className="text-2xl font-bold"
            error={errors.amount?.message}
            {...register("amount")}
          />
          <Controller
            control={control}
            name="direction"
            render={({ field }) => (
              <SelectField
                label="Tipo"
                options={[
                  { value: "EXPENSE", label: "Gasto" },
                  { value: "INCOME", label: "Ingreso" },
                ]}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  setDirection(v);
                  setCategoryId(null);
                }}
              />
            )}
          />
          <Controller
            control={control}
            name="walletId"
            render={({ field }) => (
              <SelectField
                label="Cartera"
                options={walletOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.walletId?.message}
              />
            )}
          />
          <ComboboxField
            label="Categoria"
            placeholder="Buscar..."
            options={categoryOptions}
            value={categoryId ?? ""}
            onChange={setCategoryId}
          />
          <Controller
            control={control}
            name="occurredOn"
            render={({ field }) => (
              <DateField
                label="Fecha"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                error={errors.occurredOn?.message}
              />
            )}
          />
          <TextField label="Comercio" {...register("merchant")} />
          <TextField label="Nota" {...register("note")} />
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Registrar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2** — `git add apps/desktop/src/modules/atlas.pfm/components/ReceiptReviewSheet.jsx && git commit -m "feat(pfm-ui): receipt review sheet (prefilled from parse)"`

---

## Task 4: `ReceiptsScreen.jsx`

**Files:** `apps/desktop/src/modules/atlas.pfm/screens/ReceiptsScreen.jsx` (create)

- [ ] **Step 1: Confirm the uploader component** — `grep -n "ImageUploader\|FileUploader" packages/ui/src/index.js`. Prefer `ImageUploader` (single image, camera-friendly `accept="image/*"`). Check its props (`onSelect` / `onChange` / `onUpload` — it may expect to do its own upload; if so use the raw `<input type="file" accept="image/*" capture="environment">` wrapped in a `@atlas/ui` `Button` `asChild`-style label, OR `FileUploader` with `onFilesSelected`). Wire whichever gives you a raw `File` to hand to `useUploadReceipt`.

- [ ] **Step 2: Write the screen**

```jsx
// apps/desktop/src/modules/atlas.pfm/screens/ReceiptsScreen.jsx
import { useRef, useState } from "react";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Alert,
  AlertTitle,
  AlertDescription,
} from "@atlas/ui";
import { Upload, ReceiptText, RotateCcw } from "lucide-react";
import { useReceipts, useUploadReceipt, useRetryReceipt } from "../hooks/use-pfm-queries";
import { ReceiptReviewSheet } from "../components/ReceiptReviewSheet";
import { ReceiptThumb } from "../components/ReceiptThumb";

const STATUS = {
  PROCESSING: { label: "Procesando", variant: "outline" },
  PARSED: { label: "Listo para revisar", variant: "warning" },
  FAILED: { label: "Error", variant: "outline" },
  CONFIRMED: { label: "Registrado", variant: "success" },
};

export default function ReceiptsScreen() {
  const inputRef = useRef(null);
  const { data: receipts = [], isLoading, isError, refetch } = useReceipts();
  const uploadMut = useUploadReceipt();
  const retryMut = useRetryReceipt();
  const [reviewReceipt, setReviewReceipt] = useState(null);
  const [notConfigured, setNotConfigured] = useState(false);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await uploadMut.mutateAsync(file);
      setNotConfigured(false);
    } catch (err) {
      if (String(err?.message ?? "").includes("no esta configurado")) setNotConfigured(true);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader
        title="Tickets"
        description="Sube una foto y la IA precarga el gasto"
        actions={
          <Button onClick={() => inputRef.current?.click()} disabled={uploadMut.isPending}>
            <Upload className="mr-1.5 h-4 w-4" /> Subir ticket
          </Button>
        }
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />

      {notConfigured && (
        <Alert className="mb-4">
          <AlertTitle>Lector de tickets no configurado</AlertTitle>
          <AlertDescription>
            Falta la clave del servicio de IA. Puedes registrar tus gastos manualmente desde
            cada cartera mientras tanto.
          </AlertDescription>
        </Alert>
      )}

      {isLoading && <LoadingState />}
      {isError && <ErrorState title="No se pudieron cargar los tickets" onRetry={refetch} />}
      {!isLoading && !isError && receipts.length === 0 && !notConfigured && (
        <EmptyState
          icon={ReceiptText}
          title="Sin tickets"
          description="Sube la foto de un ticket y la IA detectara el monto, la fecha y el comercio."
          action={{ label: "Subir ticket", onClick: () => inputRef.current?.click() }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {receipts.map((r) => {
          const s = STATUS[r.status] ?? { label: r.status, variant: "outline" };
          return (
            <Card key={r.id} variant="solid" className="overflow-hidden">
              <ReceiptThumb fileId={r.fileId} />
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={s.variant}>{s.label}</Badge>
                  {r.parsed?.total != null && (
                    <span className="text-sm font-semibold">${Number(r.parsed.total).toFixed(2)}</span>
                  )}
                </div>
                <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                  {r.parsed?.merchant ?? r.errorReason ?? "—"}
                </p>
                {r.status === "PARSED" && (
                  <Button size="sm" className="w-full" onClick={() => setReviewReceipt(r)}>
                    Revisar y registrar
                  </Button>
                )}
                {r.status === "FAILED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => retryMut.mutate(r.id)}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reintentar
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <ReceiptReviewSheet
        open={Boolean(reviewReceipt)}
        onOpenChange={(v) => !v && setReviewReceipt(null)}
        receipt={reviewReceipt}
      />
    </div>
  );
}
```

- [ ] **Step 3: Write `ReceiptThumb.jsx`** at `apps/desktop/src/modules/atlas.pfm/components/ReceiptThumb.jsx`:

```jsx
// apps/desktop/src/modules/atlas.pfm/components/ReceiptThumb.jsx
import { ReceiptText } from "lucide-react";
import { useReceiptImageUrl } from "../lib/receipt-image";

export function ReceiptThumb({ fileId }) {
  const { data: url } = useReceiptImageUrl(fileId);
  return (
    <div className="flex aspect-video items-center justify-center bg-[hsl(var(--muted))]">
      {url ? (
        <img src={url} alt="Ticket" className="h-full w-full object-cover" />
      ) : (
        <ReceiptText className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
      )}
    </div>
  );
}
```

- [ ] **Step 4** — `git add apps/desktop/src/modules/atlas.pfm/screens/ReceiptsScreen.jsx apps/desktop/src/modules/atlas.pfm/components/ReceiptThumb.jsx && git commit -m "feat(pfm-ui): tickets screen (upload + status grid)"`

---

## Task 5: Register the screen

**Files:** `apps/desktop/src/app/ModuleOutlet.jsx` (modify)

- [ ] **Step 1: `SCREEN_MAP`** — with the other `atlas.pfm:*` entries:

```js
  "atlas.pfm:/receipts": lazy(
    () => import("../modules/atlas.pfm/screens/ReceiptsScreen.jsx"),
  ),
```

- [ ] **Step 2: `resolveScreen` `atlas.pfm` branch** — before `return null;`:

```js
    if (subPath === "/receipts") return SCREEN_MAP["atlas.pfm:/receipts"] ?? null;
```

- [ ] **Step 3** — `git add apps/desktop/src/app/ModuleOutlet.jsx && git commit -m "feat(pfm-ui): register tickets screen"`

---

## Task 6: Build + QA

- [ ] **Step 1** — `node --test "apps/desktop/src/modules/atlas.pfm/__tests__/*.test.js"` → still PASS.
- [ ] **Step 2** — `pnpm --filter @atlas/desktop build:web` → success.
- [ ] **Step 3** — `pnpm build` → success.
- [ ] **Step 4 (QA)** — start `pnpm dev`, open Tickets. Without a `GROQ_API_KEY` the upload returns 503 → verify the `Alert` shows. With a key: upload a real receipt photo, watch the card go Procesando → Listo para revisar, open "Revisar y registrar", confirm, verify a `POSTED` movement appears in the target wallet with the ticket image attached in its detail. Screenshot Tickets (empty / grid / review sheet) at **390px** and **1440px**; 14-aspect checklist. Fix + re-shoot. Commit fixes.

---

## Self-Review

- **Spec coverage (§9 Tickets, §6.1 steps 3-6):** upload button with camera (`accept="image/*" capture="environment"`) → Task 4. Thumbnail grid with the 4 statuses (Procesando / Listo para revisar / Error / Registrado) → Task 4. Poll while `PROCESSING` (list every 4s, detail every 3s), stop on transition → Task 1. `PARSED` → tap opens the **prefilled** form (amount = `total`, date = `date`, merchant = `merchant`, wallet = last/first) → Task 3. Confirm → `confirmReceipt` creates a `POSTED` movement + links the receipt (Plan A) → Task 3. `FAILED` → "Reintentar" (`retryReceipt`) → Task 4. Manual-entry fallback when the service is unconfigured (503) → `Alert` in Task 4. Receipt image shown in the review sheet and as the card thumbnail via a signed URL → Tasks 2, 3, 4. Screen registered → Task 5.
- **Placeholder scan:** Tasks 2 and 4 Step 1 carry explicit "confirm the real method/prop name with this `grep`" instructions rather than guessed APIs — these are resolution steps, not TODOs, and each names the fallback (`files.getSignedUrl` vs `files.signedUrl`; `ImageUploader` vs raw `<input>`).
- **Type consistency:** hook names (`useReceipts`, `useReceipt`, `useUploadReceipt`, `useConfirmReceipt`, `useRetryReceipt`, `useReceiptImageUrl`) defined in Tasks 1-2, used in Tasks 3-4. Receipt shape (`{ id, fileId, status, parsed:{merchant,total,currency,date,taxAmount,lines,confidence}, movementId, errorReason, attempts }`) matches Plan A's `shape()`. `confirmReceipt({ id, walletId, direction, amount, occurredOn, categoryId, merchant, note })` matches Plan A's `confirmReceiptSchema` + route. Route path `/app/m/atlas.pfm/receipts` matches the Phase 1 manifest nav.
