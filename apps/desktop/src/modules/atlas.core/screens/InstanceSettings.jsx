import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  ComboboxField,
  PageHeader,
  Skeleton,
  TextField,
} from "@atlas/ui";
import { BellRing, Building2, Clock3, Coins, Mail, Settings } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { CURRENCY_OPTIONS, TIME_ZONE_OPTIONS } from "../../../lib/localeCatalogs";

function SettingsTabs() {
  const base = "px-4 py-2 text-sm font-medium rounded-lg transition-colors";
  const active = `${base} bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]`;
  const inactive = `${base} text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]/50`;
  return (
    <div className="flex gap-1 border-b border-[hsl(var(--border))] pb-3">
      <NavLink to="/app/m/atlas.core/settings" end className={({ isActive }) => isActive ? active : inactive}>
        <Settings className="h-4 w-4 inline mr-1.5 -mt-0.5" />
        General
      </NavLink>
      <NavLink to="/app/m/atlas.core/settings/smtp" className={({ isActive }) => isActive ? active : inactive}>
        <Mail className="h-4 w-4 inline mr-1.5 -mt-0.5" />
        SMTP
      </NavLink>
      <NavLink to="/app/m/atlas.core/settings/webpush" className={({ isActive }) => isActive ? active : inactive}>
        <BellRing className="h-4 w-4 inline mr-1.5 -mt-0.5" />
        Web Push
      </NavLink>
    </div>
  );
}

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
    description: "",
    timeZone: "America/Mexico_City",
    currency: "MXN",
  });

  useEffect(() => {
    const data = configQuery.data?.data;
    if (!data) return;
    setForm({
      instanceName: data.instanceName ?? "",
      description: data.description ?? "",
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
          title="Configuracion"
          description="Ajusta la configuracion general y las integraciones de tu instancia."
        />
        <SettingsTabs />

        {!canManage && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-sm px-4 py-3 text-[hsl(var(--muted-foreground))]">
            Necesitas permiso core.manage para modificar la configuración de la instancia.
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
                  <Skeleton className="h-20 w-full rounded-lg" />
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

                <div className="space-y-2">
                  <label
                    htmlFor="instance-description"
                    className="text-sm font-medium text-[hsl(var(--foreground))]"
                  >
                    Descripción
                  </label>
                  <textarea
                    id="instance-description"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value.slice(0, 500) }))
                    }
                    disabled={!canManage}
                    placeholder="Describe brevemente tu operación o alcance de la instancia."
                    rows={3}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-[hsl(var(--muted-foreground))] text-right">
                    {form.description.length}/500
                  </p>
                </div>

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
