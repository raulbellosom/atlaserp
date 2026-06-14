import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  DataTable,
  ErrorState,
  PageHeader,
  StatCard,
} from "@atlas/ui";
import {
  CircleCheckBig,
  Clock3,
  UserPlus,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "../../../auth/AuthProvider.jsx";
import { atlas } from "../../../lib/atlas.js";
import { CreateLeadDialog } from "../components/CreateLeadDialog.jsx";
import {
  LEAD_PRIORITY_OPTIONS,
  LEAD_STATUS_OPTIONS,
  getLeadPriorityLabel,
  getLeadPriorityVariant,
  getLeadStatusLabel,
  getLeadStatusVariant,
} from "../lib/growth-leads.js";

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function GrowthLeadsScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) =>
    Boolean(userProfile?.isAdmin || permissions.includes(key));
  const canRead = hasPermission("growth.leads.read");
  const canCreate = hasPermission("growth.leads.create");
  const [createOpen, setCreateOpen] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["growth", "leads", "summary"],
    queryFn: () => atlas.growth.getLeadSummary(token),
    enabled: Boolean(token && canRead),
  });
  const leadsQuery = useQuery({
    queryKey: ["growth", "leads", "list"],
    queryFn: () =>
      atlas.growth.listLeads(token, {
        page: 1,
        pageSize: 100,
        enabled: true,
      }),
    enabled: Boolean(token && canRead),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => atlas.growth.createLead(payload, token),
    onSuccess: async () => {
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["growth", "leads"] });
      toast.success("Lead creado");
    },
    onError: (error) =>
      toast.error(error?.message || "No se pudo crear el lead"),
  });

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Lead",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() =>
              navigate(`/app/m/atlas.growth/leads/${row.original.id}`)
            }
            className="text-left"
          >
            <span className="block font-medium text-[hsl(var(--foreground))] hover:underline">
              {row.original.name || row.original.email || "Lead sin nombre"}
            </span>
            <span className="block text-xs text-[hsl(var(--muted-foreground))]">
              {row.original.companyName || row.original.source || "Web"}
            </span>
          </button>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ getValue }) => (
          <Badge variant={getLeadStatusVariant(getValue())}>
            {getLeadStatusLabel(getValue())}
          </Badge>
        ),
      },
      {
        accessorKey: "priority",
        header: "Prioridad",
        cell: ({ getValue }) => (
          <Badge variant={getLeadPriorityVariant(getValue())}>
            {getLeadPriorityLabel(getValue())}
          </Badge>
        ),
      },
      {
        accessorKey: "email",
        header: "Contacto",
        cell: ({ row }) => (
          <div className="text-sm">
            <span className="block">{row.original.email || "Sin correo"}</span>
            <span className="block text-xs text-[hsl(var(--muted-foreground))]">
              {row.original.phone || "Sin teléfono"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Entrada",
        cell: ({ getValue }) => formatDate(getValue()),
      },
    ],
    [navigate],
  );

  const filters = useMemo(
    () => [
      {
        key: "status",
        label: "Estado",
        options: LEAD_STATUS_OPTIONS,
      },
      {
        key: "priority",
        label: "Prioridad",
        options: LEAD_PRIORITY_OPTIONS,
      },
    ],
    [],
  );

  if (!canRead) {
    return (
      <div className="min-h-dvh p-4 md:p-6">
        <PageHeader eyebrow="Atlas Growth" title="Leads" />
        <ErrorState message="No tienes permisos para consultar leads." />
      </div>
    );
  }

  const summary = summaryQuery.data?.data ?? {};
  const rows = leadsQuery.data?.data?.rows ?? [];

  return (
    <div className="min-h-dvh space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Atlas Growth"
        title="Leads"
        description="Clasifica, asigna y convierte las consultas recibidas desde tu sitio web."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo lead
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total"
          value={summary.total ?? 0}
          icon={UsersRound}
          loading={summaryQuery.isLoading}
        />
        <StatCard
          label="Nuevos"
          value={summary.new ?? 0}
          icon={UserRoundSearch}
          loading={summaryQuery.isLoading}
        />
        <StatCard
          label="En seguimiento"
          value={summary.followUp ?? 0}
          icon={Clock3}
          loading={summaryQuery.isLoading}
        />
        <StatCard
          label="Convertidos"
          value={summary.converted ?? 0}
          icon={CircleCheckBig}
          loading={summaryQuery.isLoading}
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        filters={filters}
        isLoading={leadsQuery.isLoading}
        isError={leadsQuery.isError}
        onRetry={() => leadsQuery.refetch()}
        searchPlaceholder="Buscar por nombre, correo, teléfono o empresa..."
        emptyTitle="No hay leads"
        emptyDescription="Los nuevos formularios y registros manuales aparecerán aquí."
        emptyIcon={UserRoundSearch}
        pageSize={20}
      />

      <CreateLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(payload) => createMutation.mutate(payload)}
        loading={createMutation.isPending}
      />
    </div>
  );
}
