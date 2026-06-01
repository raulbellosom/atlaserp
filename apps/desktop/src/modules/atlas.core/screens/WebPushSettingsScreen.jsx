import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, Input, Label, PageHeader, Skeleton } from "@atlas/ui";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider.jsx";
import { getApiUrl } from "../../../lib/runtimeConfig.js";

function SettingsTabs() {
  const base = "px-4 py-2 text-sm font-medium rounded-lg transition-colors";
  const active = `${base} bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]`;
  const inactive = `${base} text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]/50`;
  return (
    <div className="flex gap-1 border-b border-[hsl(var(--border))] pb-3">
      <NavLink to="/app/m/atlas.core/settings" end className={({ isActive }) => isActive ? active : inactive}>
        General
      </NavLink>
      <NavLink to="/app/m/atlas.core/settings/smtp" className={({ isActive }) => isActive ? active : inactive}>
        SMTP
      </NavLink>
      <NavLink to="/app/m/atlas.core/settings/webpush" className={({ isActive }) => isActive ? active : inactive}>
        Web Push
      </NavLink>
    </div>
  );
}

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const EMPTY = { subject: "mailto:admin@example.com", publicKey: "", privateKey: "" };

export default function WebPushSettingsScreen() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [form, setForm] = useState(EMPTY);
  const [privateKeyChanged, setPrivateKeyChanged] = useState(false);

  const configQuery = useQuery({
    queryKey: ["webpush-settings"],
    queryFn: () => apiFetch("/settings/notifications/webpush", token),
    enabled: Boolean(token),
  });

  useEffect(() => {
    const data = configQuery.data?.data;
    if (!data) return;
    setForm({
      subject: data.subject || "mailto:admin@example.com",
      publicKey: data.publicKey || "",
      privateKey: "",
    });
    setPrivateKeyChanged(false);
  }, [configQuery.data]);

  const generateMutation = useMutation({
    mutationFn: () => apiFetch("/settings/notifications/webpush/generate", token, { method: "POST" }),
    onSuccess: (response) => {
      const data = response?.data ?? {};
      setForm((prev) => ({
        ...prev,
        publicKey: data.publicKey ?? prev.publicKey,
        privateKey: data.privateKey ?? prev.privateKey,
      }));
      setPrivateKeyChanged(true);
      toast.success("Llaves VAPID generadas.");
    },
    onError: (err) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      apiFetch("/settings/notifications/webpush", token, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Configuracion Web Push guardada.");
      configQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      apiFetch("/settings/notifications/webpush", token, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Configuracion Web Push eliminada.");
      setForm(EMPTY);
      setPrivateKeyChanged(false);
      configQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSave(e) {
    e.preventDefault();
    if (!form.privateKey.trim()) {
      toast.error("Debes incluir la llave privada para guardar.");
      return;
    }
    saveMutation.mutate({
      subject: form.subject.trim(),
      publicKey: form.publicKey.trim(),
      privateKey: form.privateKey.trim(),
    });
  }

  const configured = configQuery.data?.data?.configured ?? false;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-3xl mx-auto w-full">
        <PageHeader
          eyebrow="Atlas Core"
          title="Configuracion"
          description="Configura las llaves VAPID para notificaciones push en PWA."
        />
        <SettingsTabs />

        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <BellRing className="h-4 w-4" />
              Notificaciones Web Push
            </p>
            {configured && (
              <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Configurado
              </span>
            )}
          </div>
          <div className="p-4 space-y-4">
            {configQuery.isPending ? (
              <>
                <Skeleton className="h-11 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="vapid-subject">VAPID Subject</Label>
                  <Input
                    id="vapid-subject"
                    value={form.subject}
                    onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="mailto:admin@tu-dominio.com"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vapid-public-key">Llave publica</Label>
                  <Input
                    id="vapid-public-key"
                    value={form.publicKey}
                    onChange={(e) => setForm((prev) => ({ ...prev, publicKey: e.target.value }))}
                    placeholder="BEl...."
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vapid-private-key">
                    Llave privada{" "}
                    {configured && !privateKeyChanged && (
                      <span className="text-[hsl(var(--muted-foreground))] font-normal">
                        (captura de nuevo para actualizar)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="vapid-private-key"
                    type="password"
                    value={form.privateKey}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, privateKey: e.target.value }));
                      setPrivateKeyChanged(true);
                    }}
                    placeholder={configured ? "••••••••••••••••" : ""}
                    required={!configured}
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[hsl(var(--border))]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                  >
                    {generateMutation.isPending ? "Generando..." : "Generar llaves"}
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Guardando..." : "Guardar configuracion"}
                  </Button>
                  {configured && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => clearMutation.mutate()}
                      disabled={clearMutation.isPending}
                    >
                      {clearMutation.isPending ? "Eliminando..." : "Eliminar configuracion"}
                    </Button>
                  )}
                </div>
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

