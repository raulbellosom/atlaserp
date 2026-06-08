import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button, Card, Label, PageHeader, Skeleton, Switch, TextField } from "@atlas/ui";
import { BellRing, Mail, Settings } from "lucide-react";
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

const EMPTY = { host: "", port: "587", user: "", pass: "", from_name: "", from_email: "", tls: false };

export default function SmtpSettingsScreen() {
  const { session } = useAuth();
  const token = session?.access_token;

  const [form, setForm] = useState(EMPTY);
  const [passChanged, setPassChanged] = useState(false);

  const configQuery = useQuery({
    queryKey: ["smtp-settings"],
    queryFn: () => apiFetch("/settings/smtp", token),
    enabled: Boolean(token),
  });

  useEffect(() => {
    const data = configQuery.data?.data;
    if (!data) return;
    setForm({
      host: data.host,
      port: String(data.port),
      user: data.user,
      pass: "",
      from_name: data.from_name,
      from_email: data.from_email,
      tls: data.tls,
    });
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (data) =>
      apiFetch("/settings/smtp", token, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Configuracion SMTP guardada");
      setPassChanged(false);
      configQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: () => apiFetch("/settings/smtp/test", token, { method: "POST" }),
    onSuccess: () => toast.success("Email de prueba enviado correctamente"),
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      host: form.host,
      port: Number(form.port),
      user: form.user,
      from_name: form.from_name || undefined,
      from_email: form.from_email || undefined,
      tls: form.tls,
    };
    if (passChanged && form.pass) payload.pass = form.pass;
    saveMutation.mutate(payload);
  }

  const configured = configQuery.data?.data?.configured ?? false;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-3xl mx-auto w-full">
        <PageHeader
          eyebrow="Atlas Core"
          title="Configuracion"
          description="Ajusta la configuracion general y las integraciones de tu instancia."
        />
        <SettingsTabs />

        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 flex items-center justify-between">
            <p className="text-sm font-semibold">Correo electronico (SMTP)</p>
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
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-11 col-span-1 rounded-lg" />
                  <Skeleton className="h-11 rounded-lg" />
                </div>
                <Skeleton className="h-11 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg" />
                <div className="flex justify-end">
                  <Skeleton className="h-10 w-40 rounded-xl" />
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <TextField
                      label="Servidor (host)"
                      placeholder="smtp.gmail.com"
                      value={form.host}
                      onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                      required
                    />
                  </div>
                  <TextField
                    label="Puerto"
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                    required
                  />
                </div>

                <TextField
                  label="Usuario"
                  type="email"
                  placeholder="usuario@dominio.com"
                  value={form.user}
                  onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
                  required
                />

                <TextField
                  label="Contrasena"
                  type="password"
                  description={configured && !passChanged ? "(dejar en blanco para mantener)" : undefined}
                  placeholder={configured ? "••••••••" : ""}
                  value={form.pass}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, pass: e.target.value }));
                    setPassChanged(true);
                  }}
                />

                <TextField
                  label="Nombre del remitente"
                  placeholder="Atlas ERP"
                  value={form.from_name}
                  onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
                />

                <TextField
                  label="Email del remitente"
                  type="email"
                  value={form.from_email}
                  onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
                />

                <div className="flex items-center gap-2">
                  <Switch
                    id="smtp-tls"
                    checked={form.tls}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, tls: v }))}
                  />
                  <Label htmlFor="smtp-tls">Usar TLS / SSL</Label>
                </div>

                <div className="flex gap-2 pt-2 border-t border-[hsl(var(--border))]">
                  <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
                    {saveMutation.isPending ? "Guardando..." : "Guardar configuracion"}
                  </Button>
                  {configured && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => testMutation.mutate()}
                      disabled={testMutation.isPending}
                    >
                      {testMutation.isPending ? "Enviando..." : "Enviar prueba"}
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
