import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  ComboboxField,
  PageHeader,
  Skeleton,
  TextField,
} from "@atlas/ui";
import { Building2, Clock3, Coins } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { CURRENCY_OPTIONS, TIME_ZONE_OPTIONS } from "../../../lib/localeCatalogs";

export default function InstanceSettings() {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const canManage = Boolean(
    userProfile?.isAdmin || userProfile?.permissions?.includes("core.manage"),
  );
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["instance-config"],
    queryFn: () => atlas.instanceConfig.get(token),
    enabled: Boolean(token),
  });

  const [form, setForm] = useState({
    instanceName: "",
    timeZone: "America/Mexico_City",
    currency: "MXN",
  });

  useEffect(() => {
    const data = configQuery.data?.data;
    if (!data) return;
    setForm({
      instanceName: data.instanceName ?? "",
      timeZone: data.timeZone ?? "America/Mexico_City",
      currency: data.currency ?? "MXN",
    });
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => atlas.instanceConfig.update(form, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["instance-config"] });
      toast.success("Configuración guardada");
    },
    onError: () => toast.error("No se pudo guardar la configuración"),
  });

  const isLoading = configQuery.isLoading;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-3xl mx-auto w-full">
        <PageHeader
          eyebrow="Atlas Core"
          title="Configuración de instancia"
          description="Ajusta el nombre, zona horaria y moneda predeterminada de tu instancia."
        />

        {!canManage && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-sm px-4 py-3 text-[hsl(var(--muted-foreground))]">
            Necesitas permiso core.manage para modificar la configuracion de la instancia.
          </div>
        )}

        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
            <p className="text-sm font-semibold">Ajustes generales</p>
          </div>
          <div className="p-4 space-y-4">
            {isLoading ? (
              <>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-10 w-28 rounded-xl" />
                </div>
              </>
            ) : (
              <>
                <TextField
                  label="Nombre de la instancia"
                  icon={Building2}
                  value={form.instanceName}
                  onChange={(e) => setForm((f) => ({ ...f, instanceName: e.target.value }))}
                  disabled={!canManage}
                  placeholder="Mi Empresa ERP"
                />
                <ComboboxField
                  label="Zona horaria"
                  icon={Clock3}
                  options={TIME_ZONE_OPTIONS}
                  value={form.timeZone}
                  onChange={(value) => setForm((f) => ({ ...f, timeZone: value }))}
                  placeholder="Seleccionar zona horaria"
                  searchPlaceholder="Buscar zona horaria..."
                  emptyText="No se encontraron zonas horarias"
                  className={!canManage ? "opacity-60 pointer-events-none" : ""}
                />
                <ComboboxField
                  label="Moneda"
                  icon={Coins}
                  options={CURRENCY_OPTIONS}
                  value={form.currency}
                  onChange={(value) => setForm((f) => ({ ...f, currency: value }))}
                  placeholder="Seleccionar moneda"
                  searchPlaceholder="Buscar moneda..."
                  emptyText="No se encontraron monedas"
                  className={!canManage ? "opacity-60 pointer-events-none" : ""}
                />
                <div className="flex justify-end pt-2 border-t border-[hsl(var(--border))]">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={!canManage || saveMutation.isPending || !form.instanceName}
                  >
                    {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
