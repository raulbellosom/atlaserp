import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  Bell,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@atlas/ui";
import { atlas } from "../lib/atlas";

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `hace ${days} día${days !== 1 ? "s" : ""}`;
  if (hours > 0) return `hace ${hours} hora${hours !== 1 ? "s" : ""}`;
  if (minutes > 0) return `hace ${minutes} minuto${minutes !== 1 ? "s" : ""}`;
  return "hace un momento";
}

const KIND_ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
};

const KIND_COLORS = {
  info: "#3b82f6",
  warning: "#f59e0b",
  error: "#ef4444",
  success: "#22c55e",
};

export function NotificationBell({
  token,
  onNavigate,
  onSeeAll,
}) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", token],
    queryFn: () => atlas.notifications.list(token, { unreadOnly: false, limit: 20 }),
    enabled: Boolean(token),
    refetchInterval: 15000,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });

  const notifications = Array.isArray(data) ? data : (data?.data ?? []);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const recent = notifications.slice(0, 10);

  const markAllRead = useMutation({
    mutationFn: () => atlas.notifications.markAllRead(token),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", token] }),
  });

  const markOneRead = useMutation({
    mutationFn: (id) => atlas.notifications.markRead(token, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", token] }),
  });

  async function handleNotificationClick(notification) {
    if (!notification) return;
    if (!notification.read) {
      try {
        await markOneRead.mutateAsync(notification.id);
      } catch {}
    }
    if (notification.link && typeof onNavigate === "function") {
      onNavigate(notification.link);
      return;
    }
    if (typeof onSeeAll === "function") {
      onSeeAll();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title="Notificaciones"
          className="relative h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors duration-150 outline-none"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none pointer-events-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(var(--border))] shrink-0">
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
            Notificaciones
          </span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer disabled:opacity-50"
            >
              Marcar todo como leído
            </button>
          )}
        </div>
        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-[hsl(var(--muted-foreground))]">
              <Bell size={24} className="opacity-40" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            recent.map((notification) => {
              const KindIcon = KIND_ICONS[notification.kind] ?? Info;
              const kindColor =
                KIND_COLORS[notification.kind] ?? KIND_COLORS.info;
              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer text-left border-b border-[hsl(var(--border))] last:border-0"
                >
                  <KindIcon
                    size={14}
                    className="mt-0.5 shrink-0"
                    style={{ color: kindColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-medium truncate ${
                        notification.read
                          ? "text-[hsl(var(--muted-foreground))]"
                          : "text-[hsl(var(--foreground))]"
                      }`}
                    >
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <span
                      className="h-2 w-2 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: "var(--brand-primary)" }}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-[hsl(var(--border))] p-2">
          <button
            type="button"
            onClick={() => onSeeAll?.()}
            className="w-full rounded-md px-3 py-2 text-xs text-left text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
          >
            Ver todas las notificaciones
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
