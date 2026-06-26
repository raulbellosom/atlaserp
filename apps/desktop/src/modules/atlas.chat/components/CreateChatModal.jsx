import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  TextField,
} from "@atlas/ui";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

function UserPickerItem({ user, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(user)}
      className={[
        "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors",
        selected
          ? "bg-[hsl(var(--primary)/0.1)] ring-1 ring-[hsl(var(--primary))]"
          : "hover:bg-[hsl(var(--muted))]",
      ].join(" ")}
    >
      <div className="h-8 w-8 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs font-semibold shrink-0">
        {user.displayName?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{user.displayName}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{user.email}</p>
      </div>
      {selected && (
        <span className="ml-auto text-[hsl(var(--primary))] text-sm font-bold">✓</span>
      )}
    </button>
  );
}

export function CreateChatModal({ open, onClose, onCreated }) {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const { data: usersData } = useQuery({
    queryKey: ["users-for-chat-picker"],
    queryFn: () => atlas.identity.listUsers(token, { limit: 100 }),
    enabled: Boolean(open && token),
    staleTime: 60_000,
  });

  const users = (usersData?.data ?? []).filter(
    (u) =>
      u.id !== userProfile?.id &&
      (!search ||
        u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())),
  );

  const isGroup = selected.length > 1;

  function toggleUser(u) {
    setSelected((prev) =>
      prev.some((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u],
    );
  }

  async function handleCreate() {
    if (!selected.length) return;
    setIsCreating(true);
    setError(null);
    try {
      const result = await atlas.chat.createConversation(
        {
          type: isGroup ? "group" : "direct",
          title: isGroup && groupTitle.trim() ? groupTitle.trim() : undefined,
          memberUserIds: selected.map((u) => u.id),
        },
        token,
      );
      onCreated?.(result?.data ?? result);
      onClose?.();
      setSelected([]);
      setGroupTitle("");
      setSearch("");
    } catch (err) {
      setError(err?.message ?? "Error creando conversacion.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva conversacion</DialogTitle>
          <DialogDescription>
            Selecciona uno o varios usuarios para chatear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <TextField
            label=""
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {isGroup && (
            <TextField
              label="Nombre del grupo"
              placeholder="Ej: Equipo de ventas"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
            />
          )}

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
                >
                  {u.displayName}
                  <button type="button" onClick={() => toggleUser(u)} className="ml-0.5 hover:opacity-70">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="space-y-1 max-h-60 overflow-y-auto">
            {users.map((u) => (
              <UserPickerItem
                key={u.id}
                user={u}
                selected={selected.some((s) => s.id === u.id)}
                onToggle={toggleUser}
              />
            ))}
            {!users.length && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                No se encontraron usuarios.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selected.length || isCreating}
          >
            {isCreating ? "Creando..." : isGroup ? "Crear grupo" : "Iniciar chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
