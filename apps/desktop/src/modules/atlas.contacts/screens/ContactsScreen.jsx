import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AtlasTable, Button, ConfirmDialog, PageHeader } from "@atlas/ui";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import {
  ContactFormSheet,
  resolveContactsBlueprint,
} from "../components/ContactFormSheet";

const API_BASE_URL = import.meta.env.VITE_ATLAS_API_URL || "http://localhost:4010";

const CONTACTS_BLUEPRINT = {
  key: "contacts.list",
  schema: {
    apiPath: "/contacts",
    primaryField: "name",
    searchable: true,
    searchPlaceholder: "Buscar contacto...",
    columns: [
      { field: "name", label: "Nombre", sortable: true, link: true },
      { field: "type", label: "Tipo", sortable: true },
      { field: "email", label: "Correo", sortable: false },
      { field: "phone", label: "Telefono", sortable: false },
      { field: "taxId", label: "RFC / ID fiscal", sortable: false },
    ],
    emptyState: { message: "No hay contactos registrados." },
  },
};

export default function ContactsScreen() {
  const { session } = useAuth();
  const token = session?.access_token;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const blueprintsQuery = useQuery({
    queryKey: ["blueprints", token],
    queryFn: () => atlas.blueprints.list(token),
    enabled: Boolean(token),
  });

  const formBlueprint = useMemo(
    () => resolveContactsBlueprint(blueprintsQuery.data?.data ?? []),
    [blueprintsQuery.data],
  );

  function openCreate() {
    setEditingContact(null);
    setSheetOpen(true);
  }

  function openEdit(contact) {
    setEditingContact(contact);
    setSheetOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: (data) => atlas.contacts.create(data, token),
    onSuccess: () => {
      setSheetOpen(false);
      setRefreshSignal((s) => s + 1);
      toast.success("Contacto creado");
    },
    onError: () => toast.error("No se pudo crear el contacto"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => atlas.contacts.update(id, data, token),
    onSuccess: () => {
      setSheetOpen(false);
      setEditingContact(null);
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

  function handleFormSubmit(data) {
    const payload = { ...data, email: data.email || undefined };
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Contacts"
        title="Contactos"
        description="Clientes, proveedores y personas vinculadas a tu empresa."
        actions={
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nuevo contacto
          </Button>
        }
      />

      <AtlasTable
        blueprint={CONTACTS_BLUEPRINT}
        token={token}
        apiBaseUrl={API_BASE_URL}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={(row) => setConfirmDelete(row)}
        refreshSignal={refreshSignal}
      />

      <ContactFormSheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (!v) setEditingContact(null);
        }}
        contact={editingContact}
        blueprint={formBlueprint}
        onSubmit={handleFormSubmit}
        isMutating={isMutating}
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
    </div>
  );
}
