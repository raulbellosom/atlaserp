import { useMemo, useState } from "react";
import { PageHeader, DataTable, Button, ConfirmDialog, SelectField, ErrorState, Badge } from "@atlas/ui";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { useChatReports, useResolveReport } from "../../atlas.chat/hooks/useChatModeration";

const REASON_LABELS = { spam: "Spam", abuse: "Acoso o abuso", inappropriate: "Contenido inapropiado", other: "Otro" };
const STATUS_LABELS = { open: "Abierto", dismissed: "Desestimado", user_disabled: "Usuario deshabilitado" };

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ChatReportsScreen() {
  const { userProfile } = useAuth();
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) => Boolean(userProfile?.isAdmin || permissions.includes(key));

  const canRead = hasPermission("identity.chat_reports.read");
  const canManage = hasPermission("identity.chat_reports.manage");

  const [statusFilter, setStatusFilter] = useState("open");
  const [resolveTarget, setResolveTarget] = useState(null); // { report, action }

  const { data, isLoading, isError } = useChatReports(statusFilter === "all" ? undefined : statusFilter);
  const { mutate: resolveMutate, isPending: resolving } = useResolveReport();
  const reports = data?.data ?? [];

  const columns = useMemo(() => [
    { accessorKey: "reporterDisplayName", header: "Reportante" },
    { accessorKey: "reportedDisplayName", header: "Usuario reportado" },
    { accessorKey: "reason", header: "Motivo", cell: ({ row }) => REASON_LABELS[row.original.reason] ?? row.original.reason },
    { accessorKey: "note", header: "Nota", cell: ({ row }) => row.original.note || "—" },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "open" ? "secondary" : "success"}>
          {STATUS_LABELS[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    { accessorKey: "createdAt", header: "Fecha", cell: ({ row }) => formatDate(row.original.createdAt) },
    ...(canManage ? [{
      id: "actions",
      header: "",
      cell: ({ row }) => row.original.status !== "open" ? null : (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setResolveTarget({ report: row.original, action: "dismiss" })}>
            Desestimar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-500 border-red-500/40 hover:bg-red-500/10"
            onClick={() => setResolveTarget({ report: row.original, action: "disable_user" })}
          >
            Deshabilitar usuario
          </Button>
        </div>
      ),
    }] : []),
  ], [canManage]);

  function handleConfirmResolve() {
    if (!resolveTarget) return;
    resolveMutate(
      { reportId: resolveTarget.report.id, action: resolveTarget.action },
      {
        onSuccess: () => toast.success(resolveTarget.action === "dismiss" ? "Reporte desestimado." : "Usuario deshabilitado."),
        onError: () => toast.error("No se pudo resolver el reporte."),
      },
    );
    setResolveTarget(null);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Identity"
        title="Reportes de chat"
        description="Revisa reportes de usuarios filtrados desde atlas.chat."
      />

      {canRead ? (
        <>
          <div className="max-w-xs">
            <SelectField
              label="Estado"
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "open", label: "Abierto" },
                { value: "dismissed", label: "Desestimado" },
                { value: "user_disabled", label: "Usuario deshabilitado" },
                { value: "all", label: "Todos" },
              ]}
            />
          </div>

          {isError ? (
            <ErrorState description="No se pudieron cargar los reportes." />
          ) : (
            <DataTable
              columns={columns}
              data={reports}
              isLoading={isLoading}
              emptyTitle="Sin reportes"
              emptyDescription="No hay reportes de chat con este filtro."
              emptyIcon={Flag}
            />
          )}
        </>
      ) : (
        <ErrorState description="No tienes permisos para consultar reportes de chat." />
      )}

      <ConfirmDialog
        open={Boolean(resolveTarget)}
        onOpenChange={(v) => !v && setResolveTarget(null)}
        title={resolveTarget?.action === "dismiss" ? "Desestimar reporte" : "Deshabilitar usuario"}
        description={
          resolveTarget?.action === "dismiss"
            ? "Este reporte se marcara como desestimado."
            : `${resolveTarget?.report?.reportedDisplayName ?? "Este usuario"} sera deshabilitado y no podra iniciar sesion.`
        }
        confirmLabel={resolveTarget?.action === "dismiss" ? "Desestimar" : "Deshabilitar"}
        onConfirm={handleConfirmResolve}
        loading={resolving}
      />
    </div>
  );
}
