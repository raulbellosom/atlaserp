// apps/desktop/src/modules/atlas.pfm/components/WalletMembersDialog.jsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  TextField,
  SelectField,
  Badge,
  EmptyState,
  ConfirmDialog,
} from "@atlas/ui";
import { Trash2 } from "lucide-react";
import {
  useWalletMembers,
  useUpsertWalletMember,
  useRemoveWalletMember,
} from "../hooks/use-pfm-queries";

const ROLE_OPTIONS = [
  { value: "VIEWER", label: "Puede ver" },
  { value: "EDITOR", label: "Puede editar" },
];

export function WalletMembersDialog({ open, onOpenChange, wallet }) {
  const { data: members = [] } = useWalletMembers(wallet?.id, open);
  const upsert = useUpsertWalletMember();
  const remove = useRemoveWalletMember();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [removeTarget, setRemoveTarget] = useState(null);

  if (!wallet) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Colaboradores de {wallet.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {members.length === 0 ? (
            <EmptyState
              title="Sin colaboradores"
              description="Comparte esta cartera agregando a alguien de tu empresa."
            />
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <span className="truncate text-sm">{m.userId}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{m.role === "EDITOR" ? "Editor" : "Lector"}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Quitar"
                      onClick={() => setRemoveTarget(m)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              label="ID de usuario"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="min-w-[180px] flex-1"
            />
            <SelectField label="Rol" options={ROLE_OPTIONS} value={role} onChange={setRole} />
            <Button
              type="button"
              disabled={!userId || upsert.isPending}
              onClick={async () => {
                await upsert.mutateAsync({ walletId: wallet.id, userId, role });
                setUserId("");
              }}
            >
              Agregar
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(v) => !v && setRemoveTarget(null)}
        title="Quitar colaborador"
        description="Esta persona dejara de ver esta cartera."
        confirmLabel="Quitar"
        onConfirm={async () => {
          await remove.mutateAsync({ walletId: wallet.id, userId: removeTarget.userId });
          setRemoveTarget(null);
        }}
      />
    </Dialog>
  );
}
