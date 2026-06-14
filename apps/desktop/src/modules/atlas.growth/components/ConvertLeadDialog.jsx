import { useCallback, useEffect, useState } from "react";
import {
  Button,
  ConfirmDialog,
  ContactPicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SelectField,
  TextField,
} from "@atlas/ui";

import { atlas } from "../../../lib/atlas.js";

const CONTACT_TYPES = [
  { value: "customer", label: "Cliente" },
  { value: "person", label: "Persona" },
  { value: "company", label: "Empresa" },
];

export function ConvertLeadDialog({
  open,
  onOpenChange,
  lead,
  token,
  canUseExisting,
  canCreateContact,
  onConfirm,
  loading = false,
}) {
  const initialMode = canUseExisting ? "existing" : "create";
  const [mode, setMode] = useState(initialMode);
  const [contact, setContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    type: "customer",
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (!open) {
      setMode(initialMode);
      setContact(null);
      setConfirmOpen(false);
      setNewContact({
        type: "customer",
        name: lead?.name ?? "",
        email: lead?.email ?? "",
        phone: lead?.phone ?? "",
      });
    }
  }, [initialMode, lead?.email, lead?.name, lead?.phone, open]);

  const searchContacts = useCallback(
    async (query) => {
      const response = await atlas.contacts.picker(token, {
        q: query,
        limit: 10,
      });
      return response?.data ?? [];
    },
    [token],
  );

  const modes = [
    canUseExisting
      ? { value: "existing", label: "Vincular contacto existente" }
      : null,
    canCreateContact
      ? { value: "create", label: "Crear contacto nuevo" }
      : null,
  ].filter(Boolean);

  const valid =
    mode === "existing"
      ? Boolean(contact?.id)
      : Boolean(newContact.name.trim());

  function payload() {
    if (mode === "existing") {
      return {
        mode,
        contactId: contact.id,
        updatedAt: lead.updatedAt,
      };
    }
    return {
      mode,
      updatedAt: lead.updatedAt,
      contact: {
        type: newContact.type,
        name: newContact.name.trim(),
        email: newContact.email.trim() || undefined,
        phone: newContact.phone.trim() || undefined,
      },
    };
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Convertir lead</DialogTitle>
            <DialogDescription>
              La conversión es terminal y vincula este lead con Atlas Contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <SelectField
              label="Conversión"
              value={mode}
              options={modes}
              onValueChange={setMode}
            />

            {mode === "existing" ? (
              <ContactPicker
                value={contact}
                onChange={setContact}
                searchContacts={searchContacts}
                placeholder="Buscar por nombre, correo o teléfono..."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Tipo"
                  value={newContact.type}
                  options={CONTACT_TYPES}
                  onValueChange={(value) =>
                    setNewContact((current) => ({
                      ...current,
                      type: value,
                    }))
                  }
                />
                <TextField
                  label="Nombre"
                  required
                  value={newContact.name}
                  onChange={(event) =>
                    setNewContact((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
                <TextField
                  label="Correo"
                  type="email"
                  value={newContact.email}
                  onChange={(event) =>
                    setNewContact((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
                <TextField
                  label="Teléfono"
                  value={newContact.phone}
                  onChange={(event) =>
                    setNewContact((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!valid || loading}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar conversión"
        description="El lead quedará convertido y ya no admitirá cambios operativos."
        confirmLabel="Convertir"
        loading={loading}
        onConfirm={() => onConfirm(payload())}
      />
    </>
  );
}
