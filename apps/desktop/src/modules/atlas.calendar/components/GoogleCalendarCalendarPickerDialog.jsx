import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Star,
  Trash2,
  Unplug,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@atlas/ui";
import { toast } from "sonner";
import {
  useDisconnectGoogleCalendar,
  useGoogleCalendarList,
  useGoogleCalendarSources,
  useSaveGoogleCalendarSources,
  useGoogleCalendarStatus,
  useStartGoogleCalendarConnect,
} from "../hooks/useGoogleCalendarData";

function SourceStatusBadge({ status }) {
  if (status === "ACTIVE") return <Badge variant="success">Activo</Badge>;
  if (status === "SYNCING")
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Sincronizando
      </Badge>
    );
  if (status === "PENDING_INITIAL_SYNC")
    return <Badge variant="outline">Pendiente</Badge>;
  if (status === "ERROR") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="secondary">{status || "Sin estado"}</Badge>;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        d="M16.27 9.2c0-.58-.05-1.13-.15-1.66H9v3.14h4.08a3.5 3.5 0 0 1-1.52 2.3v1.91h2.46c1.44-1.33 2.25-3.3 2.25-5.69Z"
        fill="#4285F4"
      />
      <path
        d="M9 16.58c2.04 0 3.75-.67 5-1.82l-2.46-1.91c-.68.46-1.55.73-2.54.73-1.96 0-3.62-1.32-4.2-3.08H2.26v1.97A7.55 7.55 0 0 0 9 16.58Z"
        fill="#34A853"
      />
      <path
        d="M4.8 10.5A4.54 4.54 0 0 1 4.57 9c0-.52.08-1.01.23-1.5V5.53H2.26A7.57 7.57 0 0 0 1.42 9c0 1.2.29 2.33.84 3.47L4.8 10.5Z"
        fill="#FBBC05"
      />
      <path
        d="M9 4.42c1.1 0 2.09.38 2.87 1.12l2.15-2.15C12.74 2.18 11.04 1.42 9 1.42A7.55 7.55 0 0 0 2.26 5.53L4.8 7.5C5.38 5.74 7.04 4.42 9 4.42Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function CalendarRow({ item, checked, linkedSource, onToggle }) {
  function handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onToggle(item.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={checked}
      onClick={() => onToggle(item.id)}
      onKeyDown={handleKeyDown}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
        checked
          ? "border-[hsl(var(--ring)/0.6)] bg-[hsl(var(--surface-2))]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] hover:border-[hsl(var(--border)/0.8)] hover:bg-[hsl(var(--surface-2))]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className="h-3 w-3 shrink-0 rounded-full ring-2 ring-[hsl(var(--background))]"
          style={{ backgroundColor: item.backgroundColor || "#1a73e8" }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                {item.summary || "Sin nombre"}
              </p>
              {item.primary ? (
                <Star
                  className="h-3 w-3 shrink-0 text-amber-400"
                  aria-label="Principal"
                />
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {linkedSource ? (
                <SourceStatusBadge status={linkedSource.syncStatus} />
              ) : null}
            </div>
          </div>
          <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
            {item.timeZone || "Sin zona horaria"}
          </p>
        </div>

        <Checkbox
          checked={checked}
          onCheckedChange={() => onToggle(item.id)}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>
  );
}

function ConnectionHeader({
  connection,
  connectedAtLabel,
  isConnected,
  syncingCount,
  errorCount,
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-[hsl(var(--surface-2))] px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 rounded-lg bg-[hsl(var(--muted))]/60 dark:bg-white/5 p-2">
          <GoogleMark />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
              Integracion con Google Calendar
            </p>
            <Badge
              variant={isConnected ? "success" : "secondary"}
              className="text-[10px]"
            >
              {isConnected ? "Conectada" : "Sin conectar"}
            </Badge>
            {syncingCount > 0 ? (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Importando {syncingCount}
              </Badge>
            ) : null}
            {errorCount > 0 ? (
              <Badge variant="destructive" className="text-[10px]">
                Error {errorCount}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            {isConnected && connection?.googleEmail
              ? connectedAtLabel
                ? `${connection.googleEmail} · vinculada el ${connectedAtLabel}`
                : connection.googleEmail
              : "Conecta una cuenta para descubrir y vincular calendarios."}
          </p>
        </div>
      </div>
    </div>
  );
}

const CAPABILITY_ITEMS = [
  "Descubre todos los calendarios de tu cuenta Google.",
  "Cada calendario seleccionado crea o reutiliza uno interno en Atlas.",
  "La importacion inicial corre en segundo plano.",
  "Si editas un evento importado, Atlas lo desacopla de futuras reimportaciones.",
];

function IntegrationInfoBar({
  isConnected,
  syncingCount,
  errorCount,
  startConnect,
  onConnect,
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Que hace
          </p>
        </div>
        <ul className="space-y-1.5">
          {CAPABILITY_ITEMS.map((text) => (
            <li
              key={text}
              className="flex items-start gap-2 text-xs text-[hsl(var(--muted-foreground))]"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--muted-foreground)/0.4)]" />
              {text}
            </li>
          ))}
        </ul>
      </div>

      {!isConnected ? (
        <div className="shrink-0 sm:w-44">
          <Button
            size="sm"
            onClick={onConnect}
            loading={startConnect.isPending}
            className="w-full"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Conectar con Google
          </Button>
        </div>
      ) : (
        <div className="shrink-0 sm:w-44">
          <div className="flex items-start gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
            {syncingCount > 0 ? (
              <>
                <CalendarDays className="mt-px h-3 w-3 shrink-0" />
                <span>Importaciones activas en segundo plano.</span>
              </>
            ) : errorCount > 0 ? (
              <span>Hay calendarios con error que requieren revision.</span>
            ) : (
              <>
                <CheckCircle2 className="mt-px h-3 w-3 shrink-0 text-emerald-500" />
                <span>Conexion lista para administrar.</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DisconnectConfirmDialog({ open, onClose, onConfirm, isLoading }) {
  const [deleteEvents, setDeleteEvents] = useState(false);

  function handleConfirm() {
    onConfirm({ deleteEvents });
  }

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      setDeleteEvents(false);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Unplug className="h-4 w-4" />
            Desconectar Google Calendar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Al desconectar, Atlas dejara de sincronizar eventos de esta cuenta.
            Los calendarios internos creados desde Google permanecen en Atlas.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[hsl(var(--foreground))]">
              Eventos importados
            </p>

            <button
              type="button"
              onClick={() => setDeleteEvents(false)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                !deleteEvents
                  ? "border-[hsl(var(--ring)/0.6)] bg-[hsl(var(--surface-2))]"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] hover:bg-[hsl(var(--surface-2))]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                    !deleteEvents
                      ? "border-[hsl(var(--ring))] bg-[hsl(var(--ring))]"
                      : "border-[hsl(var(--muted-foreground)/0.4)]"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                    Conservar eventos
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Los eventos importados se mantienen en Atlas.
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDeleteEvents(true)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                deleteEvents
                  ? "border-red-500/40 bg-red-500/5"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] hover:bg-[hsl(var(--surface-2))]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                    deleteEvents
                      ? "border-red-500 bg-red-500"
                      : "border-[hsl(var(--muted-foreground)/0.4)]"
                  }`}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      Eliminar eventos importados
                    </p>
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Se borraran todos los eventos traidos desde Google.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {deleteEvents && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <p className="text-xs text-red-300">
                Esta accion es irreversible. Los eventos eliminados no se pueden
                recuperar.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              loading={isLoading}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
            >
              <Unplug className="h-3.5 w-3.5" />
              Desconectar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GoogleCalendarCalendarPickerDialog({ open, onClose }) {
  const {
    data: statusData,
    isLoading: isStatusLoading,
    isError: isStatusError,
    error: statusError,
    refetch: refetchStatus,
  } = useGoogleCalendarStatus();
  const startConnect = useStartGoogleCalendarConnect();
  const disconnectGoogle = useDisconnectGoogleCalendar();
  const connection = statusData?.connection;
  const isConnected =
    Boolean(connection?.googleEmail) && connection?.status === "ACTIVE";
  const {
    data: calendarsData,
    isLoading: isCalendarsLoading,
    isError: isCalendarsError,
    error: calendarsError,
    refetch: refetchCalendars,
  } = useGoogleCalendarList(open && isConnected);
  const {
    data: sourcesData,
    isLoading: isSourcesLoading,
    isError: isSourcesError,
    error: sourcesError,
    refetch: refetchSources,
  } = useGoogleCalendarSources(open && isConnected);
  const saveSources = useSaveGoogleCalendarSources();
  const [draftSelectedIds, setDraftSelectedIds] = useState(null);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);

  const items = calendarsData?.items ?? [];
  const savedSources = sourcesData?.items ?? [];
  const savedSourcesById = (() => {
    const next = new Map();

    for (const source of savedSources) {
      const sourceId =
        typeof source?.googleCalendarId === "string"
          ? source.googleCalendarId.trim()
          : "";

      if (!sourceId) continue;

      next.set(sourceId, source);
    }

    return next;
  })();
  const savedSelectionIds = (() => {
    const seen = new Set();
    const ids = [];

    for (const source of savedSources) {
      const value =
        typeof source?.googleCalendarId === "string"
          ? source.googleCalendarId.trim()
          : "";

      if (!value || seen.has(value)) continue;

      seen.add(value);
      ids.push(value);
    }

    ids.sort();
    return ids;
  })();
  const selectedIds = draftSelectedIds ?? savedSelectionIds;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isLoading =
    isStatusLoading ||
    (isConnected && (isCalendarsLoading || isSourcesLoading));
  const isError = isStatusError || isCalendarsError || isSourcesError;
  const error = statusError ?? calendarsError ?? sourcesError;
  const syncingCount = savedSources.filter(
    (item) =>
      item.syncStatus === "SYNCING" ||
      item.syncStatus === "PENDING_INITIAL_SYNC",
  ).length;
  const errorCount = savedSources.filter(
    (item) => item.syncStatus === "ERROR",
  ).length;
  const connectedAtLabel = connection?.connectedAt
    ? new Date(connection.connectedAt).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  function handleClose(nextOpen) {
    if (!nextOpen) {
      setDraftSelectedIds(null);
      onClose();
    }
  }

  function handleRetry() {
    refetchStatus();
    refetchCalendars();
    refetchSources();
  }

  function toggleSelection(calendarId) {
    setDraftSelectedIds((current) => {
      const baseIds = current ?? savedSelectionIds;
      const next = new Set(baseIds);

      if (next.has(calendarId)) {
        next.delete(calendarId);
      } else {
        next.add(calendarId);
      }

      return Array.from(next);
    });
  }

  async function handleConnect() {
    try {
      const result = await startConnect.mutateAsync();
      if (result?.authUrl) {
        window.location.assign(result.authUrl);
        return;
      }
      toast.error("Google no devolvio una URL de conexion valida.");
    } catch (connectError) {
      toast.error(
        connectError?.message || "No se pudo iniciar la conexion con Google.",
      );
    }
  }

  async function handleDisconnect({ deleteEvents }) {
    try {
      await disconnectGoogle.mutateAsync({ deleteEvents });
      toast.success(
        deleteEvents
          ? "Cuenta desconectada y eventos eliminados."
          : "Cuenta de Google desconectada.",
      );
      setDisconnectConfirmOpen(false);
      setDraftSelectedIds(null);
      onClose();
    } catch (disconnectError) {
      toast.error(
        disconnectError?.message ||
          "No se pudo desconectar la cuenta de Google.",
      );
    }
  }

  async function handleSave() {
    const selectedItems = items.filter((item) => selectedSet.has(item.id));

    if (selectedItems.length === 0) {
      toast.error("Selecciona al menos un calendario de Google.");
      return;
    }

    try {
      await saveSources.mutateAsync({
        calendars: selectedItems,
      });
      toast.success("Calendarios de Google vinculados.");
      setDraftSelectedIds(null);
      onClose();
    } catch (saveError) {
      toast.error(
        saveError?.message ||
          "No se pudieron guardar los calendarios de Google.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Google Calendar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ConnectionHeader
            connection={connection}
            connectedAtLabel={connectedAtLabel}
            isConnected={isConnected}
            syncingCount={syncingCount}
            errorCount={errorCount}
          />

          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-4 py-3">
            <IntegrationInfoBar
              isConnected={isConnected}
              syncingCount={syncingCount}
              errorCount={errorCount}
              startConnect={startConnect}
              onConnect={handleConnect}
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : null}

          {isError ? (
            <ErrorState
              title="No se pudieron obtener los calendarios"
              description={
                error?.message || "Reconecta la cuenta o intenta mas tarde."
              }
              onRetry={handleRetry}
              className="px-4 py-6"
            />
          ) : null}

          {!isLoading && !isError && !statusData?.configured ? (
            <EmptyState
              icon={Link2}
              title="Google Calendar no configurado"
              description="Esta instancia aun no tiene listas las variables de entorno de Google OAuth."
              className="px-4 py-8"
            />
          ) : null}

          {!isLoading && !isError && statusData?.configured && !isConnected ? (
            <EmptyState
              icon={CalendarDays}
              title="Conecta tu cuenta para administrar calendarios"
              description="Al conectar Google podras elegir calendarios, importar eventos en segundo plano y administrar la vinculacion desde este mismo modal."
              className="px-4 py-8"
            />
          ) : null}

          {!isLoading && !isError && isConnected && items.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No hay calendarios disponibles"
              description="Google no devolvio calendarios para esta cuenta."
              className="px-4 py-8"
            />
          ) : null}

          {!isLoading && !isError && isConnected && items.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    Calendarios Google
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Elige cuales quieres vincular a Atlas.
                  </p>
                </div>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {selectedIds.length} seleccionado
                  {selectedIds.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-0.5">
                {items.map((item) => (
                  <CalendarRow
                    key={item.id}
                    item={item}
                    checked={selectedSet.has(item.id)}
                    linkedSource={savedSourcesById.get(item.id) ?? null}
                    onToggle={toggleSelection}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {isConnected ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-red-400">
                    Zona peligrosa
                  </p>
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    Desconectar elimina el acceso de Atlas a tu cuenta Google.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisconnectConfirmOpen(true)}
                  className="shrink-0 border-red-500/30 text-red-400 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Unplug className="h-3.5 w-3.5" />
                  Desconectar
                </Button>
              </div>
            </div>
          ) : null}

          <DisconnectConfirmDialog
            open={disconnectConfirmOpen}
            onClose={() => setDisconnectConfirmOpen(false)}
            onConfirm={handleDisconnect}
            isLoading={disconnectGoogle.isPending}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            {isConnected ? (
              <Button
                size="sm"
                onClick={handleSave}
                loading={saveSources.isPending}
                disabled={
                  isLoading || items.length === 0 || selectedIds.length === 0
                }
              >
                Guardar seleccion
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
