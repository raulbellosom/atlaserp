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
            Falta la clave del servicio de IA. Puedes registrar tus gastos manualmente desde cada
            cartera mientras tanto.
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
                    <span className="text-sm font-semibold">
                      ${Number(r.parsed.total).toFixed(2)}
                    </span>
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
