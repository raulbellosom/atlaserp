import { useMemo, useState } from "react";
import { AtlasTable, PageHeader } from "@atlas/ui";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthProvider";
import { atlas } from "../../lib/atlas";
import ActivityDetailSheet from "./ActivityDetailSheet";

const API_BASE_URL =
  import.meta.env.VITE_ATLAS_API_URL || "http://localhost:4010";

const SEVERITY_OPTIONS = [
  { value: "info", label: "Info" },
  { value: "success", label: "Éxito" },
  { value: "warning", label: "Advertencia" },
  { value: "critical", label: "Crítico" },
];

const ACTIVITY_BLUEPRINT = {
  key: "activity.list",
  schema: {
    apiPath: "/activity",
    primaryField: "summary",
    searchable: true,
    searchPlaceholder: "Buscar en actividad…",
    defaultViewMode: "table",
    columns: [
      { field: "createdAt", label: "Fecha", type: "date", sortable: true },
      {
        field: "severity",
        label: "Severidad",
        type: "select",
        sortable: true,
        options: SEVERITY_OPTIONS,
      },
      { field: "type", label: "Tipo", sortable: true },
      { field: "actor.displayName", label: "Actor", sortable: false },
      {
        field: "summary",
        label: "Resumen",
        sortable: false,
        link: true,
        isLink: true,
      },
      { field: "entityType", label: "Entidad", sortable: true },
      {
        field: "entityId",
        label: "ID Entidad",
        sortable: false,
        defaultVisible: false,
      },
      {
        field: "source",
        label: "Origen",
        sortable: true,
        defaultVisible: false,
      },
    ],
    filters: [
      {
        key: "severity",
        label: "Severidad",
        type: "select",
        options: SEVERITY_OPTIONS,
      },
      { key: "type", label: "Tipo", type: "text" },
    ],
    emptyState: { message: "Aún no hay actividad para tu empresa." },
  },
};

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
}

export default function ActivityFeedScreen() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [selected, setSelected] = useState(null);

  const bulkActions = useMemo(
    () => [
      {
        label: "Exportar Excel",
        icon: FileSpreadsheet,
        onClick: async (selectedRows) => {
          try {
            const ids = selectedRows.map((row) => row.id).filter(Boolean);
            if (!ids.length) return;
            const blob = await atlas.activity.exportExcel({ ids }, token);
            downloadBlob(
              blob,
              `actividad-${new Date().toISOString().slice(0, 10)}.xlsx`,
            );
            toast.success("Excel generado");
          } catch {
            toast.error("No se pudo exportar el archivo Excel");
          }
        },
      },
    ],
    [token],
  );

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Activity"
        title="Actividad"
        description="Bitácora legible de eventos recientes de tu empresa."
      />
      <AtlasTable
        blueprint={ACTIVITY_BLUEPRINT}
        token={token}
        apiBaseUrl={API_BASE_URL}
        onView={setSelected}
        bulkActions={bulkActions}
      />
      <ActivityDetailSheet
        activity={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
