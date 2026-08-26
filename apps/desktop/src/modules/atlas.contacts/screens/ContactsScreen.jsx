import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AtlasTable, Button, ConfirmDialog, ErrorState, PageHeader } from "@atlas/ui";
import { FileSpreadsheet, FileText, Power, PowerOff, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { getApiUrl } from "../../../lib/runtimeConfig.js";
import {
  ContactFormSheet,
  resolveContactsBlueprint,
} from "../components/ContactFormSheet";

const API_BASE_URL = getApiUrl();

const CONTACTS_BLUEPRINT = {
  key: "contacts.list",
  schema: {
    apiPath: "/contacts",
    primaryField: "name",
    searchable: true,
    searchPlaceholder: "Buscar contacto...",
    columns: [
      { field: "name", label: "Nombre", sortable: true, link: true },
      {
        field: "type",
        label: "Tipo",
        sortable: true,
        type: "select",
        options: [
          { value: "customer", label: "Cliente" },
          { value: "supplier", label: "Proveedor" },
          { value: "person", label: "Persona" },
          { value: "company", label: "Empresa" },
        ],
      },
      { field: "email", label: "Correo", sortable: false },
      { field: "phone", label: "Telefono", sortable: false },
      { field: "taxId", label: "RFC / ID fiscal", sortable: false },
      {
        field: "enabled",
        label: "Estado",
        type: "select",
        sortable: false,
        options: [
          { value: true, label: "Activo" },
          { value: false, label: "Inactivo" },
        ],
      },
      { field: "legalName", label: "Razon social", defaultVisible: false },
      { field: "notesMarkdown", label: "Notas", type: "markdown", defaultVisible: false },
      { field: "createdAt", label: "Creado", type: "date", defaultVisible: false },
    ],
    filters: [
      {
        key: "enabled",
        label: "Estado",
        type: "select",
        options: [
          { value: "true", label: "Activo" },
          { value: "false", label: "Inactivo" },
        ],
      },
    ],
    emptyState: { message: "No hay contactos registrados." },
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

function getUniformStatusMode(rows) {
  if (!rows.length) return "mixed";
  const allEnabled = rows.every((row) => Boolean(row.enabled));
  const allDisabled = rows.every((row) => !row.enabled);
  if (allEnabled) return "disable";
  if (allDisabled) return "enable";
  return "mixed";
}

export default function ContactsScreen() {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const authUserId = session?.user?.id ?? "anonymous";
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) => Boolean(userProfile?.isAdmin || permissions.includes(key));
  const canReadContacts = hasPermission("contacts.contacts.read");
  const canCreateContacts = hasPermission("contacts.contacts.create");
  const canUpdateContacts = hasPermission("contacts.contacts.update");
  const canDeleteContacts = hasPermission("contacts.contacts.delete");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [bulkState, setBulkState] = useState(null);

  const { "*": wildcard } = useParams();
  const navigate = useNavigate();
  const urlContactMatch = wildcard?.match(/^contacts\/([^/]+)$/);
  const urlContactId = urlContactMatch?.[1] ?? null;

  const blueprintsQuery = useQuery({
    queryKey: ["blueprints", "contacts", authUserId],
    queryFn: () => atlas.blueprints.list(token),
    enabled: Boolean(token),
  });

  // A URL-referenced contact may not be in the currently-loaded list page
  // (pagination) — always fetch it independently by id, never assume it's
  // already among the loaded rows.
  const urlContactQuery = useQuery({
    queryKey: ["contact", urlContactId, authUserId],
    queryFn: () => atlas.contacts.getById(urlContactId, token),
    enabled: Boolean(urlContactId && token),
  });

  useEffect(() => {
    if (!urlContactId) return;
    if (urlContactQuery.data?.data) {
      setEditingContact(urlContactQuery.data.data);
      setSheetOpen(true);
    } else if (urlContactQuery.isError) {
      toast.error("No se pudo cargar el contacto.");
      navigate("/app/m/atlas.contacts/contacts");
    }
  }, [urlContactId, urlContactQuery.data, urlContactQuery.isError, navigate]);

  const formBlueprint = useMemo(
    () => resolveContactsBlueprint(blueprintsQuery.data?.data ?? []),
    [blueprintsQuery.data],
  );

  // Single close path for the sheet, used regardless of how it's closing
  // (X/backdrop/Escape via onOpenChange, or a successful create/update) — a
  // contact reached via /contacts/:id must always return the URL to the list
  // on close, not just on the interactive-close path (spec Section 23 edge
  // case 3 / acceptance criterion 4).
  function closeSheet() {
    setSheetOpen(false);
    setEditingContact(null);
    if (urlContactId) navigate("/app/m/atlas.contacts/contacts");
  }

  function openCreate() {
    if (urlContactId) navigate("/app/m/atlas.contacts/contacts");
    setEditingContact(null);
    setSheetOpen(true);
  }

  function openEdit(contact) {
    setEditingContact(contact);
    setSheetOpen(true);
    navigate(`/app/m/atlas.contacts/contacts/${contact.id}`);
  }

  const createMutation = useMutation({
    mutationFn: (data) => atlas.contacts.create(data, token),
    onSuccess: () => {
      closeSheet();
      setRefreshSignal((s) => s + 1);
      toast.success("Contacto creado");
    },
    onError: () => toast.error("No se pudo crear el contacto"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => atlas.contacts.update(id, data, token),
    onSuccess: () => {
      closeSheet();
      setRefreshSignal((s) => s + 1);
      toast.success("Contacto actualizado");
    },
    onError: () => toast.error("No se pudo actualizar el contacto"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => atlas.contacts.delete(id, token),
    onSuccess: () => {
      setConfirmDelete(null);
      setRefreshSignal((s) => s + 1);
      toast.success("Contacto eliminado");
    },
    onError: () => toast.error("No se pudo eliminar el contacto"),
  });

  const bulkEnabledMutation = useMutation({
    mutationFn: ({ ids, enabled }) =>
      atlas.contacts.setContactsEnabled(ids, enabled, token),
    onSuccess: () => {
      setRefreshSignal((s) => s + 1);
      setBulkState(null);
      toast.success("Contactos actualizados");
    },
    onError: () => toast.error("No se pudo actualizar el estado de los contactos"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => atlas.contacts.deleteContactsBulk(ids, token),
    onSuccess: () => {
      setRefreshSignal((s) => s + 1);
      setBulkState(null);
      toast.success("Contactos eliminados");
    },
    onError: () => toast.error("No se pudieron eliminar los contactos"),
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: ({ id, enabled }) => atlas.contacts.setEnabled(id, enabled, token),
    onSuccess: (_, { enabled }) => {
      setRefreshSignal((s) => s + 1);
      toast.success(enabled ? "Contacto activado" : "Contacto desactivado");
    },
    onError: () => toast.error("No se pudo actualizar el estado del contacto"),
  });

  const bulkActions = useMemo(() => [
    {
      label: "Exportar Excel",
      icon: FileSpreadsheet,
      onClick: async (selectedRows) => {
        try {
          const ids = selectedRows.map((row) => row.id).filter(Boolean);
          if (!ids.length) return;
          const blob = await atlas.contacts.exportContactsExcel(ids, token);
          downloadBlob(blob, `contactos-${new Date().toISOString().slice(0, 10)}.xlsx`);
          toast.success("Excel generado");
        } catch {
          toast.error("No se pudo exportar el archivo Excel");
        }
      },
    },
    {
      label: "Exportar PDF",
      icon: FileText,
      onClick: async (selectedRows) => {
        try {
          const ids = selectedRows.map((row) => row.id).filter(Boolean);
          if (!ids.length) return;
          const blob = await atlas.contacts.exportContactsPdf(ids, token);
          downloadBlob(blob, `contactos-${new Date().toISOString().slice(0, 10)}.pdf`);
          toast.success("PDF generado");
        } catch {
          toast.error("No se pudo generar el PDF");
        }
      },
    },
    canUpdateContacts && ((selectedRows) => {
      const mode = getUniformStatusMode(selectedRows);
      if (mode === "mixed") {
        return {
          label: "Estado",
          icon: Power,
          disabled: true,
          title: "Solo disponible cuando todos tienen el mismo estado.",
          onClick: () => {},
        };
      }
      const enabling = mode === "enable";
      return {
        label: enabling ? "Activar" : "Desactivar",
        icon: enabling ? Power : PowerOff,
        onClick: () =>
          setBulkState({ type: "enable", rows: selectedRows, enabled: enabling }),
      };
    }),
    canDeleteContacts && ((selectedRows) => ({
      label: "Eliminar",
      icon: Trash2,
      variant: "destructive",
      onClick: () => setBulkState({ type: "delete", rows: selectedRows }),
    })),
  ].filter(Boolean), [token, canUpdateContacts, canDeleteContacts]);

  function handleFormSubmit(data) {
    const payload = { ...data, email: data.email || undefined };
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  if (!canReadContacts) {
    return (
      <div className="p-4 md:p-6 space-y-6 min-h-dvh">
        <PageHeader
          eyebrow="Atlas Contacts"
          title="Contactos"
          description="Clientes, proveedores y personas vinculadas a tu empresa."
        />
        <ErrorState message="No tienes permisos para ver los contactos." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Contacts"
        title="Contactos"
        description="Clientes, proveedores y personas vinculadas a tu empresa."
        actions={
          canCreateContacts && (
            <Button onClick={openCreate}>
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo contacto
            </Button>
          )
        }
      />

      <AtlasTable
        blueprint={CONTACTS_BLUEPRINT}
        token={token}
        apiBaseUrl={API_BASE_URL}
        onCreate={canCreateContacts ? openCreate : undefined}
        onEdit={canUpdateContacts ? openEdit : undefined}
        onToggleEnabled={canUpdateContacts ? (row) =>
          toggleEnabledMutation.mutate({ id: row.id, enabled: !row.enabled }) : undefined}
        onDelete={canDeleteContacts ? (row) => setConfirmDelete(row) : undefined}
        refreshSignal={refreshSignal}
        bulkActions={bulkActions}
      />

      <ContactFormSheet
        open={sheetOpen}
        onOpenChange={(v) => {
          if (v) setSheetOpen(true);
          else closeSheet();
        }}
        contact={editingContact}
        blueprint={formBlueprint}
        onSubmit={handleFormSubmit}
        isMutating={isMutating}
        token={token}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Eliminar contacto"
        description="El contacto sera eliminado permanentemente. Esta accion no se puede deshacer."
        detail={confirmDelete?.name}
        confirmLabel="Eliminar"
        onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(bulkState)}
        onOpenChange={(v) => !v && setBulkState(null)}
        title={
          bulkState?.type === "delete"
            ? "Eliminar contactos seleccionados"
            : bulkState?.enabled
              ? "Activar contactos seleccionados"
              : "Desactivar contactos seleccionados"
        }
        description={
          bulkState?.type === "delete"
            ? "Esta accion elimina los contactos de forma permanente."
            : "Se actualizara el estado de los contactos seleccionados."
        }
        detail={`${bulkState?.rows?.length ?? 0} contactos seleccionados`}
        confirmLabel={bulkState?.type === "delete" ? "Eliminar" : "Confirmar"}
        onConfirm={() => {
          const ids = (bulkState?.rows ?? []).map((r) => r.id).filter(Boolean);
          if (!ids.length) {
            setBulkState(null);
            return;
          }
          if (bulkState?.type === "delete") {
            bulkDeleteMutation.mutate(ids);
          } else {
            bulkEnabledMutation.mutate({ ids, enabled: Boolean(bulkState?.enabled) });
          }
        }}
        loading={bulkDeleteMutation.isPending || bulkEnabledMutation.isPending}
      />
    </div>
  );
}
