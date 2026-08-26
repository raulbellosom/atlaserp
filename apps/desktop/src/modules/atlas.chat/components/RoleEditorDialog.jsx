import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Checkbox,
} from "@atlas/ui";
import { CHAT_PERMISSIONS } from "../lib/chatPermissions";

const PERMISSION_LABELS = {
  [CHAT_PERMISSIONS.CHANNEL_MANAGE]: "Editar el canal",
  [CHAT_PERMISSIONS.MEMBERS_MANAGE]: "Gestionar miembros",
  [CHAT_PERMISSIONS.ROLES_MANAGE]: "Gestionar roles",
  [CHAT_PERMISSIONS.MESSAGES_SEND]: "Enviar mensajes",
  [CHAT_PERMISSIONS.MESSAGES_PIN]: "Fijar mensajes",
  [CHAT_PERMISSIONS.MESSAGES_DELETE_OTHERS]: "Eliminar mensajes de otros",
  [CHAT_PERMISSIONS.MENTIONS_EVERYONE]: "Mencionar @everyone",
  [CHAT_PERMISSIONS.MENTIONS_HERE]: "Mencionar @here",
};

// role: null (creating) or an existing role object (editing). maxPosition: the
// highest position value the current actor is allowed to set (their own
// position minus 1 — enforced again server-side regardless).
export function RoleEditorDialog({ open, onClose, role, maxPosition, onSave, isSaving }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [position, setPosition] = useState(0);
  const [permissions, setPermissions] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName(role?.name ?? "");
      setColor(role?.color ?? "");
      setPosition(role?.position ?? Math.max(0, Math.min(maxPosition, 10)));
      setPermissions(role?.permissions ?? {});
      setError(null);
    }
  }, [open, role, maxPosition]);

  function togglePermission(key) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        color: color.trim() || undefined,
        position: Number(position),
        permissions,
      });
      onClose?.();
    } catch (err) {
      setError(err?.message ?? "Error guardando el rol.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{role ? "Editar rol" : "Crear rol"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Nombre</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Soporte" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="role-color">Color (opcional, hex)</Label>
              <Input id="role-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#6366f1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-position">Rango (0-{maxPosition})</Label>
              <Input
                id="role-position"
                type="number"
                min={0}
                max={maxPosition}
                value={position}
                onChange={(e) => setPosition(Math.max(0, Math.min(maxPosition, Number(e.target.value) || 0)))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Permisos</Label>
            <div className="space-y-1.5 rounded-lg border border-[hsl(var(--border))] p-3">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={Boolean(permissions[key])} onCheckedChange={() => togglePermission(key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving ? "Guardando..." : role ? "Guardar cambios" : "Crear rol"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
