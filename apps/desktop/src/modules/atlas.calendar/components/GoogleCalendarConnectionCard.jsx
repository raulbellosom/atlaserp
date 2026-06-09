import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { ErrorState, Skeleton } from "@atlas/ui";
import {
  useGoogleCalendarSources,
  useGoogleCalendarStatus,
} from "../hooks/useGoogleCalendarData";

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4 shrink-0" aria-hidden="true">
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

function getConnectionState({
  configured,
  connected,
  syncingCount,
  errorCount,
}) {
  if (!configured) {
    return {
      badge: "No listo",
      badgeVariant: "secondary",
      summary: "Faltan variables de entorno",
      actionLabel: "Ver",
    };
  }

  if (!connected) {
    return {
      badge: "Pendiente",
      badgeVariant: "secondary",
      summary: "Sin conectar",
      actionLabel: "Conectar",
    };
  }

  if (errorCount > 0) {
    return {
      badge: "Error",
      badgeVariant: "destructive",
      summary: `${errorCount} calendario(s) con error`,
      actionLabel: "Administrar",
    };
  }

  if (syncingCount > 0) {
    return {
      badge: "Importando",
      badgeVariant: "outline",
      summary: `${syncingCount} calendario(s) en segundo plano`,
      actionLabel: "Administrar",
    };
  }

  return {
    badge: "Conectada",
    badgeVariant: "success",
    summary: "Cuenta lista para administrar",
    actionLabel: "Administrar",
  };
}

export default function GoogleCalendarConnectionCard({ onOpen }) {
  const { data, isLoading, isError, error, refetch } =
    useGoogleCalendarStatus();
  const connection = data?.connection;
  const isConnected =
    Boolean(connection?.googleEmail) && connection?.status === "ACTIVE";
  const { data: sourcesData } = useGoogleCalendarSources(isConnected);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-[hsl(var(--surface-1))] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-2.5 w-32 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="No se pudo consultar Google Calendar"
        description={error?.message || "Reintenta en unos segundos."}
        onRetry={() => refetch()}
        className="px-4 py-6"
      />
    );
  }

  const syncingCount = (sourcesData?.items ?? []).filter(
    (item) =>
      item.syncStatus === "SYNCING" ||
      item.syncStatus === "PENDING_INITIAL_SYNC",
  ).length;
  const errorCount = (sourcesData?.items ?? []).filter(
    (item) => item.syncStatus === "ERROR",
  ).length;
  const state = getConnectionState({
    configured: Boolean(data?.configured),
    connected: isConnected,
    syncingCount,
    errorCount,
  });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
    >
      {/* Row 1: logo · name · arrow */}
      <div className="flex items-center gap-2">
        <GoogleMark />
        <span className="flex-1 truncate text-xs font-medium text-[hsl(var(--foreground))]">
          Google Calendar
        </span>
        <ArrowRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-0.5" />
      </div>

      {/* Row 2: email / status — always below */}
      <div className="mt-1 flex items-center gap-1.5 pl-6">
        {syncingCount > 0 ? (
          <>
            <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin text-[hsl(var(--muted-foreground))]" />
            <span className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">
              Importando {syncingCount}
            </span>
          </>
        ) : errorCount > 0 ? (
          <>
            <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-500" />
            <span className="truncate text-[10px] text-red-400">
              {errorCount} con error
            </span>
          </>
        ) : (
          <span className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">
            {isConnected && connection?.googleEmail
              ? connection.googleEmail
              : state.summary}
          </span>
        )}
      </div>
    </button>
  );
}
