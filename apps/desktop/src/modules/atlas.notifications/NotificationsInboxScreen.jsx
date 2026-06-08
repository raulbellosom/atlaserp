import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@atlas/ui";
import {
  Bell,
  CalendarClock,
  ExternalLink,
  Info,
  RefreshCw,
  ShoppingCart,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthProvider";
import { atlas } from "../../lib/atlas";

const PAGE_SIZE = 25;

const PRIORITY_LABELS = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

function formatAbsoluteDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function iconForEventType(eventType) {
  if (String(eventType).startsWith("calendar.")) return CalendarClock;
  if (String(eventType).startsWith("website.sale")) return ShoppingCart;
  if (String(eventType).startsWith("system.")) return ShieldAlert;
  return Info;
}

function priorityVariant(priority) {
  if (priority === "critical") return "destructive";
  if (priority === "high") return "default";
  if (priority === "low") return "secondary";
  return "outline";
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-[hsl(var(--border))] p-4 space-y-2"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default function NotificationsInboxScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, userProfile } = useAuth();
  const token = session?.access_token;

  const canRead = Boolean(
    userProfile?.isAdmin ||
      (userProfile?.permissions ?? []).includes("notifications.read"),
  );

  const [filters, setFilters] = useState({
    q: "",
    unreadOnly: "false",
    priority: "all",
    eventType: "",
  });

  const query = useInfiniteQuery({
    queryKey: ["notifications-inbox", token, filters],
    queryFn: ({ pageParam }) =>
      atlas.notifications.list(token, {
        limit: PAGE_SIZE,
        cursor: pageParam ?? undefined,
        unreadOnly: filters.unreadOnly === "true",
        priority: filters.priority !== "all" ? filters.priority : undefined,
        eventType: filters.eventType.trim() || undefined,
        q: filters.q.trim() || undefined,
      }),
    getNextPageParam: (lastPage) => lastPage?.pageInfo?.nextCursor ?? undefined,
    initialPageParam: undefined,
    enabled: Boolean(token) && canRead,
  });

  const notifications = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return pages.flatMap((page) => page?.data ?? []);
  }, [query.data]);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const markReadMutation = useMutation({
    mutationFn: (id) => atlas.notifications.markRead(token, id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["notifications-inbox", token],
      }),
    onError: () => toast.error("No se pudo marcar la notificación"),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => atlas.notifications.markAllRead(token),
    onSuccess: async (response) => {
      const updated = response?.data?.updated ?? response?.updated ?? 0;
      await queryClient.invalidateQueries({
        queryKey: ["notifications-inbox", token],
      });
      toast.success(
        updated > 0
          ? `${updated} notificaciones marcadas como leídas`
          : "No hay notificaciones pendientes",
      );
    },
    onError: () => toast.error("No se pudieron marcar como leídas"),
  });

  async function handleOpen(notification) {
    if (!notification) return;
    if (!notification.read) {
      await markReadMutation.mutateAsync(notification.id).catch(() => {});
    }
    if (notification.link) {
      if (/^https?:\/\//i.test(notification.link)) {
        window.open(notification.link, "_blank", "noopener,noreferrer");
      } else {
        navigate(notification.link);
      }
    }
  }

  if (!canRead) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Notifications"
          title="Notificaciones"
          description="Centro de alertas accionables de la plataforma."
        />
        <ErrorState message="No tienes permisos para consultar notificaciones." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        eyebrow="Atlas Notifications"
        title="Notificaciones"
        description="Revisa eventos importantes de calendario, website y sistema."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => query.refetch()}
              disabled={query.isRefetching}
            >
              <RefreshCw
                className={`h-4 w-4 ${query.isRefetching ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/app/m/atlas.notifications/settings")}
            >
              Configuración
            </Button>
            <Button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending || unreadCount === 0}
            >
              Marcar todo leído
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-[hsl(var(--border))] p-4 space-y-3 bg-[hsl(var(--card))]">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="notifications-q">Buscar</Label>
            <Input
              id="notifications-q"
              value={filters.q}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, q: event.target.value }))
              }
              placeholder="Título, cuerpo o tipo..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select
              value={filters.unreadOnly}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, unreadOnly: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Todas</SelectItem>
                <SelectItem value="true">Solo no leídas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Prioridad</Label>
            <Select
              value={filters.priority}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, priority: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notifications-event-type">Tipo de evento</Label>
            <Input
              id="notifications-event-type"
              value={filters.eventType}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  eventType: event.target.value,
                }))
              }
              placeholder="Ej: calendar.event.reminder"
            />
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <NotificationsSkeleton />
      ) : query.isError ? (
        <ErrorState
          title="No se pudieron cargar las notificaciones"
          onRetry={() => query.refetch()}
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Sin notificaciones"
          description="No hay resultados para los filtros actuales."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const EventIcon = iconForEventType(notification.eventType);
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleOpen(notification)}
                className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-left hover:border-[hsl(var(--ring))] transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-8 w-8 rounded-xl bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                    <EventIcon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                        {notification.title}
                      </p>
                      <Badge variant={priorityVariant(notification.priority)}>
                        {PRIORITY_LABELS[notification.priority] ?? "Media"}
                      </Badge>
                      {!notification.read && <Badge variant="secondary">Nueva</Badge>}
                    </div>

                    {notification.body && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        {notification.body}
                      </p>
                    )}

                    <div className="flex items-center gap-3 flex-wrap text-xs text-[hsl(var(--muted-foreground))]">
                      <span>{notification.eventType}</span>
                      <span>{formatAbsoluteDate(notification.createdAt)}</span>
                      {notification.link && (
                        <span className="inline-flex items-center gap-1">
                          Abrir
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {query.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? "Cargando..." : "Cargar más"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
