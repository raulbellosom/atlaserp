import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SelectField,
  TextareaField,
  TextField,
} from "@atlas/ui";

import { LEAD_PRIORITY_OPTIONS } from "../lib/growth-leads.js";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  companyName: "",
  message: "",
  priority: "normal",
};

export function CreateLeadDialog({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) setForm(EMPTY_FORM);
  }, [open]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      ...form,
      name: form.name.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      companyName: form.companyName.trim() || undefined,
      message: form.message.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Nuevo lead</DialogTitle>
            <DialogDescription>
              Registra una consulta recibida fuera de los formularios web.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nombre"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Nombre del prospecto"
            />
            <TextField
              label="Empresa"
              value={form.companyName}
              onChange={(event) => update("companyName", event.target.value)}
              placeholder="Empresa u organización"
            />
            <TextField
              label="Correo"
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              placeholder="nombre@empresa.com"
            />
            <TextField
              label="Teléfono"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="+52..."
            />
            <SelectField
              label="Prioridad"
              value={form.priority}
              options={LEAD_PRIORITY_OPTIONS}
              onValueChange={(value) => update("priority", value)}
            />
          </div>

          <TextareaField
            label="Mensaje"
            value={form.message}
            onChange={(event) => update("message", event.target.value)}
            maxLength={5000}
            rows={4}
            placeholder="Contexto de la consulta"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Crear lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
