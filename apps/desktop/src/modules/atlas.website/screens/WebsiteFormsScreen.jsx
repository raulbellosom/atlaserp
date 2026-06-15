import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider.jsx";
import { getApiUrl } from "../../../lib/runtimeConfig.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Card,
  ComboboxField,
  TextField,
  PageHeader,
  EmptyState,
  ConfirmDialog,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  LoadingState,
  ErrorState,
  SwitchField,
} from "@atlas/ui";
import { toast } from "sonner";
import FormFieldBuilder from "./FormFieldBuilder.jsx";
import FormSubmissionsPanel from "./FormSubmissionsPanel.jsx";

async function apiGet(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function FormSettingsPanel({
  form,
  token,
  assignees,
  turnstileConfigured,
  onSaved,
}) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    name: form.name ?? "",
    description: form.description ?? "",
    submitLabel: form.submitLabel ?? "Enviar",
    successMessage: form.successMessage ?? "",
    notifyEmail: form.notifyEmail ?? "",
    createsLead: form.createsLead ?? true,
    defaultAssigneeUserId: form.defaultAssigneeUserId ?? "",
    honeypotEnabled: form.honeypotEnabled ?? true,
    turnstileRequired: form.turnstileRequired ?? false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${getApiUrl()}/website/forms/${form.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...settings,
            description: settings.description.trim() || undefined,
            successMessage: settings.successMessage.trim() || undefined,
            notifyEmail: settings.notifyEmail.trim() || null,
            defaultAssigneeUserId:
              settings.defaultAssigneeUserId || null,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          (await response.json().catch(() => ({}))).error ||
            `HTTP ${response.status}`,
        );
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Configuracion del formulario guardada");
      queryClient.invalidateQueries({
        queryKey: ["website-form-detail", form.id],
      });
      queryClient.invalidateQueries({ queryKey: ["website-forms"] });
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });

  const assigneeOptions = [
    { value: "", label: "Sin responsable predeterminado" },
    ...assignees.map((assignee) => ({
      value: assignee.id,
      label: `${assignee.displayName} (${assignee.email})`,
    })),
  ];

  return (
    <Card className="p-4">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <TextField
            label="Nombre"
            value={settings.name}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            required
          />
          <TextField
            label="Texto del boton"
            value={settings.submitLabel}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                submitLabel: event.target.value,
              }))
            }
          />
        </div>
        <TextField
          label="Descripcion"
          value={settings.description}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
        <TextField
          label="Mensaje de exito"
          value={settings.successMessage}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              successMessage: event.target.value,
            }))
          }
        />
        <TextField
          label="Notificar por email"
          type="email"
          value={settings.notifyEmail}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              notifyEmail: event.target.value,
            }))
          }
        />
        <ComboboxField
          label="Responsable predeterminado"
          options={assigneeOptions}
          value={settings.defaultAssigneeUserId}
          onChange={(value) =>
            setSettings((current) => ({
              ...current,
              defaultAssigneeUserId: value,
            }))
          }
          placeholder="Seleccionar responsable..."
          searchPlaceholder="Buscar usuario..."
        />
        <div className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] p-3">
          <SwitchField
            id={`form-${form.id}-lead`}
            label="Crear lead"
            description="Guarda cada envio como un lead en atlas.growth"
            checked={settings.createsLead}
            onChange={(checked) =>
              setSettings((current) => ({
                ...current,
                createsLead: checked,
              }))
            }
          />
          <SwitchField
            id={`form-${form.id}-honeypot`}
            label="Activar honeypot"
            description="Campo oculto que atrapa bots sin molestar al usuario"
            checked={settings.honeypotEnabled}
            onChange={(checked) =>
              setSettings((current) => ({
                ...current,
                honeypotEnabled: checked,
              }))
            }
          />
          <SwitchField
            id={`form-${form.id}-turnstile`}
            label="Requerir Turnstile"
            description="Verificacion anti-bot de Cloudflare (configura las claves en Ajustes)"
            checked={settings.turnstileRequired}
            disabled={!turnstileConfigured}
            onChange={(checked) =>
              setSettings((current) => ({
                ...current,
                turnstileRequired: checked,
              }))
            }
          />
        </div>
        {!turnstileConfigured && (
          <p className="text-xs text-muted-foreground">
            Configura las claves de Turnstile en Ajustes antes de exigir CAPTCHA.
          </p>
        )}
        <Button
          type="submit"
          disabled={mutation.isPending || !settings.name.trim()}
        >
          {mutation.isPending ? "Guardando..." : "Guardar configuracion"}
        </Button>
      </form>
    </Card>
  );
}

export default function WebsiteFormsScreen() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [selectedFormId, setSelectedFormId] = useState(null);
  const [activeTab, setActiveTab] = useState("campos");
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [newFormData, setNewFormData] = useState({
    name: "",
    description: "",
    submitLabel: "Enviar",
    successMessage: "",
    notifyEmail: "",
    createsLead: true,
    defaultAssigneeUserId: "",
    honeypotEnabled: true,
    turnstileRequired: false,
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const siteQuery = useQuery({
    queryKey: ["website-site", token],
    queryFn: () => apiGet("/website/site", token),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const siteId = siteQuery.data?.data?.id ?? null;

  const formsQuery = useQuery({
    queryKey: ["website-forms", siteId, token],
    queryFn: () => apiGet(`/website/forms?siteId=${siteId}`, token),
    enabled: Boolean(token) && Boolean(siteId),
    staleTime: 30_000,
  });
  const forms = formsQuery.data?.data ?? [];
  const activeFormId = selectedFormId ?? forms[0]?.id ?? null;
  const selectedForm = forms.find((f) => f.id === activeFormId) ?? null;

  const formDetailQuery = useQuery({
    queryKey: ["website-form-detail", activeFormId, token],
    queryFn: () => apiGet(`/website/forms/${activeFormId}`, token),
    enabled: Boolean(token) && Boolean(activeFormId),
    staleTime: 15_000,
  });
  const formDetail = formDetailQuery.data ?? null;

  const { data: assigneesData } = useQuery({
    queryKey: ["website-form-assignees", token],
    queryFn: () => apiGet("/website/form-assignees", token),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const assignees = assigneesData?.data ?? [];

  const createFormMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`${getApiUrl()}/website/forms`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...data,
          siteId,
          description: data.description.trim() || undefined,
          successMessage: data.successMessage.trim() || undefined,
          notifyEmail: data.notifyEmail.trim() || null,
          defaultAssigneeUserId: data.defaultAssigneeUserId || null,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error || `HTTP ${res.status}`,
        );
      return res.json();
    },
    onSuccess: (form) => {
      toast.success("Formulario creado");
      queryClient.invalidateQueries({ queryKey: ["website-forms", siteId] });
      setSelectedFormId(form.id);
      setNewFormOpen(false);
      setNewFormData({
        name: "",
        description: "",
        submitLabel: "Enviar",
        successMessage: "",
        notifyEmail: "",
        createsLead: true,
        defaultAssigneeUserId: "",
        honeypotEnabled: true,
        turnstileRequired: false,
      });
    },
    onError: (err) => toast.error(err.message || "Error al crear formulario"),
  });

  const deleteFormMutation = useMutation({
    mutationFn: async (formId) => {
      const res = await fetch(`${getApiUrl()}/website/forms/${formId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al eliminar");
    },
    onSuccess: () => {
      toast.success("Formulario eliminado");
      setSelectedFormId(null);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["website-forms", siteId] });
    },
    onError: () => {
      toast.error("Error al eliminar el formulario");
      setDeleteTarget(null);
    },
  });

  if (siteQuery.isPending) return <LoadingState variant="page" />;

  if (siteQuery.isError || formsQuery.isError) {
    return (
      <div className="p-4 md:p-6">
        <ErrorState
          title="No se pudieron cargar los formularios"
          message={(siteQuery.error ?? formsQuery.error)?.message}
          onRetry={() => {
            siteQuery.refetch();
            formsQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (!siteId) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Website"
          title="Formularios"
          description="Crea formularios de contacto y captura envios desde el sitio publico."
        />
        <EmptyState
          title="Sitio web no configurado"
          description='Configura tu sitio web primero desde la seccion "Sitio web".'
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        eyebrow="Atlas Website"
        title="Formularios"
        description="Crea formularios de contacto y captura envios desde el sitio publico."
        actions={
          <Button onClick={() => setNewFormOpen(true)}>Nuevo formulario</Button>
        }
      />

      {formsQuery.isPending ? (
        <LoadingState message="Cargando formularios..." />
      ) : forms.length === 0 ? (
        <EmptyState
          title="Sin formularios"
          description="Crea tu primer formulario para capturar envios desde el sitio publico."
          action={{
            label: "Crear primer formulario",
            onClick: () => setNewFormOpen(true),
          }}
        />
      ) : (
        <div className="flex gap-6">
          <div className="w-52 shrink-0 space-y-1">
            {forms.map((form) => (
              <button
                key={form.id}
                onClick={() => {
                  setSelectedFormId(form.id);
                  setActiveTab("campos");
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeFormId === form.id
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium"
                    : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                }`}
              >
                <div className="truncate font-medium">{form.name}</div>
                <div
                  className={`text-xs mt-0.5 ${activeFormId === form.id ? "opacity-70" : "text-[hsl(var(--muted-foreground))]"}`}
                >
                  {form._count?.fields ?? 0} campo
                  {form._count?.fields !== 1 ? "s" : ""}
                  {" · "}
                  {form._count?.submissions ?? 0} envio
                  {form._count?.submissions !== 1 ? "s" : ""}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-4 min-w-0">
            {selectedForm ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-medium text-[hsl(var(--foreground))]">
                    {selectedForm.name}
                  </h2>
                  <button
                    onClick={() => setDeleteTarget(selectedForm)}
                    className="text-xs text-[hsl(var(--destructive))] hover:underline"
                  >
                    Eliminar formulario
                  </button>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="campos">Campos</TabsTrigger>
                    <TabsTrigger value="configuracion">
                      Configuracion
                    </TabsTrigger>
                    <TabsTrigger value="envios">
                      Envios
                      {(selectedForm._count?.submissions ?? 0) > 0 && (
                        <span className="ml-1.5 text-xs bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-full px-1.5 py-0.5 leading-none">
                          {selectedForm._count.submissions}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="campos">
                    {formDetailQuery.isPending ? (
                      <LoadingState message="Cargando campos..." />
                    ) : (
                      <FormFieldBuilder
                        formId={selectedForm.id}
                        fields={formDetail?.fields ?? []}
                        onRefresh={() =>
                          queryClient.invalidateQueries({
                            queryKey: ["website-form-detail", selectedForm.id],
                          })
                        }
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="configuracion">
                    {formDetailQuery.isPending ? (
                      <LoadingState message="Cargando configuracion..." />
                    ) : formDetailQuery.isError ? (
                      <ErrorState
                        title="No se pudo cargar el formulario"
                        message={formDetailQuery.error?.message}
                        onRetry={() => formDetailQuery.refetch()}
                      />
                    ) : (
                      <FormSettingsPanel
                        key={formDetail?.id}
                        form={formDetail}
                        token={token}
                        assignees={assignees}
                        turnstileConfigured={Boolean(
                          siteQuery.data?.data?.turnstileSiteKey &&
                            siteQuery.data?.data?.turnstileSecretKeySet,
                        )}
                        onSaved={() => {
                          formDetailQuery.refetch();
                          queryClient.invalidateQueries({
                            queryKey: ["website-forms", siteId],
                          });
                        }}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="envios">
                    <FormSubmissionsPanel formId={selectedForm.id} />
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="py-10 text-center">
                <p className="text-[hsl(var(--muted-foreground))] text-sm">
                  Selecciona un formulario.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={newFormOpen} onOpenChange={setNewFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo formulario</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createFormMutation.mutate(newFormData);
            }}
            className="space-y-4 py-2"
          >
            <TextField
              label="Nombre"
              value={newFormData.name}
              onChange={(e) =>
                setNewFormData((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="Contacto"
              required
              autoFocus
            />
            <TextField
              label="Descripcion (opcional)"
              value={newFormData.description}
              onChange={(e) =>
                setNewFormData((f) => ({ ...f, description: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Texto del boton"
                value={newFormData.submitLabel}
                onChange={(e) =>
                  setNewFormData((f) => ({ ...f, submitLabel: e.target.value }))
                }
              />
              <TextField
                label="Notificar por email (opcional)"
                type="email"
                value={newFormData.notifyEmail}
                onChange={(e) =>
                  setNewFormData((f) => ({ ...f, notifyEmail: e.target.value }))
                }
                placeholder="tu@empresa.com"
              />
            </div>
            <TextField
              label="Mensaje de exito (opcional)"
              value={newFormData.successMessage}
              onChange={(e) =>
                setNewFormData((f) => ({
                  ...f,
                  successMessage: e.target.value,
                }))
              }
              placeholder="Gracias, nos pondremos en contacto pronto."
            />
            <ComboboxField
              label="Responsable predeterminado"
              options={[
                { value: "", label: "Sin responsable predeterminado" },
                ...assignees.map((assignee) => ({
                  value: assignee.id,
                  label: `${assignee.displayName} (${assignee.email})`,
                })),
              ]}
              value={newFormData.defaultAssigneeUserId}
              onChange={(value) =>
                setNewFormData((current) => ({
                  ...current,
                  defaultAssigneeUserId: value,
                }))
              }
              placeholder="Seleccionar responsable..."
              searchPlaceholder="Buscar usuario..."
            />
            <div className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] p-3">
              <SwitchField
                id="new-form-lead"
                label="Crear lead"
                description="Guarda cada envio como un lead en atlas.growth"
                checked={newFormData.createsLead}
                onChange={(checked) =>
                  setNewFormData((current) => ({
                    ...current,
                    createsLead: checked,
                  }))
                }
              />
              <SwitchField
                id="new-form-honeypot"
                label="Activar honeypot"
                description="Campo oculto que atrapa bots sin molestar al usuario"
                checked={newFormData.honeypotEnabled}
                onChange={(checked) =>
                  setNewFormData((current) => ({
                    ...current,
                    honeypotEnabled: checked,
                  }))
                }
              />
              <SwitchField
                id="new-form-turnstile"
                label="Requerir Turnstile"
                description="Verificacion anti-bot de Cloudflare (configura las claves en Ajustes)"
                checked={newFormData.turnstileRequired}
                disabled={
                  !(
                    siteQuery.data?.data?.turnstileSiteKey &&
                    siteQuery.data?.data?.turnstileSecretKeySet
                  )
                }
                onChange={(checked) =>
                  setNewFormData((current) => ({
                    ...current,
                    turnstileRequired: checked,
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createFormMutation.isPending || !newFormData.name.trim()
                }
              >
                {createFormMutation.isPending
                  ? "Creando..."
                  : "Crear formulario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Eliminar formulario"
        description={`Se eliminara permanentemente el formulario "${deleteTarget?.name}" y todos sus campos y envios. Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleteFormMutation.isPending}
        onConfirm={() => deleteFormMutation.mutate(deleteTarget?.id)}
      />
    </div>
  );
}
