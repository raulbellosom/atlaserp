import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  TextField,
} from "@atlas/ui";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthProvider";
import { useActiveCompany } from "../company/ActiveCompanyProvider";
import { atlas } from "../lib/atlas";

// System-admin only (enforced server-side too — see POST /companies).
// Creates a brand-new tenant with the current user as its first admin, then
// switches into it automatically once it shows up in the membership list.
export function CreateCompanyDialog({ onClose }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { companies, setActiveCompany } = useActiveCompany();
  const [name, setName] = useState("");
  // Set once creation succeeds; the effect below watches for this id to
  // actually appear in `companies` (after the memberships query refetches)
  // before switching — setActiveCompany silently no-ops for an id it
  // doesn't yet recognize as a real membership.
  const [pendingSwitchId, setPendingSwitchId] = useState(null);

  useEffect(() => {
    if (!pendingSwitchId) return;
    if (companies.some((c) => String(c.id) === String(pendingSwitchId))) {
      setActiveCompany(pendingSwitchId);
      setPendingSwitchId(null);
    }
  }, [companies, pendingSwitchId, setActiveCompany]);

  const createMutation = useMutation({
    mutationFn: () => atlas.company.create({ name: name.trim() }, token),
    onSuccess: async (res) => {
      const newCompanyId = res?.data?.id;
      toast.success("Empresa creada");
      await queryClient.invalidateQueries({ queryKey: ["memberships-me"] });
      if (newCompanyId) setPendingSwitchId(newCompanyId);
      onClose();
    },
    onError: (err) => {
      toast.error(err?.message || "No se pudo crear la empresa");
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    createMutation.mutate();
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Crear empresa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            label="Nombre de la empresa"
            required
            placeholder="Acme Corp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Podrás completar los demás datos (dirección, marca, RFC) desde el
            módulo de Empresa una vez creada.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
