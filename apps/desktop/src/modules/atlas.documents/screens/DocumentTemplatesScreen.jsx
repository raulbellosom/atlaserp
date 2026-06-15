import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PageHeader,
  TextareaField,
  TextField,
} from "@atlas/ui";
import { FilePlus2, LayoutTemplate } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "../../../auth/AuthProvider.jsx";
import { atlas } from "../../../lib/atlas.js";

export default function DocumentTemplatesScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const permissions = userProfile?.permissions ?? [];
  const allowed = (key) => userProfile?.isAdmin || permissions.includes(key);
  const [createOpen, setCreateOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [form, setForm] = useState({ key: "", name: "", description: "" });

  const query = useQuery({
    queryKey: ["documents", "templates"],
    queryFn: () => atlas.documents.listTemplates(token, { enabled: true, pageSize: 100 }),
    enabled: Boolean(token && allowed("documents.templates.read")),
    staleTime: 30_000,
  });
  const createMutation = useMutation({
    mutationFn: () =>
      atlas.documents.createTemplate(
        { ...form, sourceType: "growth.lead" },
        token,
      ),
    onSuccess: async (created) => {
      setCreateOpen(false);
      setForm({ key: "", name: "", description: "" });
      await queryClient.invalidateQueries({ queryKey: ["documents", "templates"] });
      navigate(`/app/m/atlas.documents/templates/${created.id}/editor`);
    },
    onError: (error) => toast.error(error.message),
  });
  const toggleMutation = useMutation({
    mutationFn: (item) =>
      atlas.documents.setTemplateEnabled(
        item.id,
        { enabled: !item.enabled, updatedAt: item.updatedAt },
        token,
      ),
    onSuccess: async () => {
      setToggleTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["documents", "templates"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const columns = useMemo(() => [
    {
      accessorKey: "name",
      header: "Plantilla",
      cell: ({ row }) => (
        <button
          type="button"
          className="text-left font-medium hover:underline"
          onClick={() => navigate(`/app/m/atlas.documents/templates/${row.original.id}/editor`)}
        >
          {row.original.name}
          <span className="block text-xs text-[hsl(var(--muted-foreground))]">
            {row.original.key}
          </span>
        </button>
      ),
    },
    { accessorKey: "sourceType", header: "Origen" },
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.publishedVersionId ? "success" : "secondary"}>
          {row.original.publishedVersionId ? "Publicada" : "Borrador"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => allowed("documents.templates.delete") ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => setToggleTarget(row.original)}>
          Desactivar
        </Button>
      ) : null,
    },
  ], [navigate, permissions, userProfile?.isAdmin]);

  return (
    <div className="min-h-dvh space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Atlas Documents"
        title="Plantillas"
        description="Plantillas versionadas para generar documentos PDF."
        actions={allowed("documents.templates.create") ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <FilePlus2 className="mr-2 h-4 w-4" /> Nueva plantilla
          </Button>
        ) : null}
      />
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyIcon={LayoutTemplate}
        emptyTitle="No hay plantillas"
        emptyDescription="Crea la primera plantilla para Growth u otros proveedores."
        searchPlaceholder="Buscar plantillas..."
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva plantilla</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <TextField label="Nombre" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <TextField label="Clave" value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} placeholder="resumen-lead" />
            <TextareaField label="Descripcion" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={!form.name || !form.key || createMutation.isPending} onClick={() => createMutation.mutate()}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title="Desactivar plantilla"
        description="La plantilla dejara de estar disponible para nuevas generaciones."
        confirmLabel="Desactivar"
        onConfirm={() => toggleMutation.mutate(toggleTarget)}
        loading={toggleMutation.isPending}
      />
    </div>
  );
}
