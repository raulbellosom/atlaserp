import { Activity as ActivityIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityDrawer } from "./ActivityDrawer.jsx";

const LAST_SEEN_KEY = "atlas.activity.lastSeenAt";
const POLL_INTERVAL_MS = 15000;

function readLastSeen() {
  try {
    const v = window.localStorage.getItem(LAST_SEEN_KEY);
    return v ? new Date(v) : null;
  } catch {
    return null;
  }
}
function writeLastSeen(date) {
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, date.toISOString());
  } catch {}
}

/**
 * <ActivityBellTrigger />
 * Bell button with optional unread badge + manages the drawer state.
 * Polls /activity/recent every 15s for unread detection. If `supabase` + `companyId`
 * are provided AND sdk.activity.getRealtimeChannel exists, subscribes via Realtime
 * and falls back to polling automatically if subscribe fails.
 *
 * Props:
 *  - sdk, token: required
 *  - companyId?: string (for realtime channel)
 *  - supabase?: Supabase client (for realtime channel)
 *  - onNavigate?: (href) => void
 *  - onSeeAll?: () => void
 *  - disabled?: boolean (hide bell — e.g. user lacks permission)
 */
export function ActivityBellTrigger({
  sdk,
  token,
  companyId,
  supabase,
  onNavigate,
  onSeeAll,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [newActivity, setNewActivity] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastSeenRef = useRef(readLastSeen());

  const checkUnread = useCallback(async () => {
    if (!sdk?.activity || !token) return;
    try {
      const res = await sdk.activity.recent(token, 1);
      const latest = res?.data?.[0];
      if (!latest) return;
      const latestDate = new Date(latest.createdAt);
      const seen = lastSeenRef.current;
      if (!seen || latestDate > seen) setHasUnread(true);
    } catch {
      // ignore
    }
  }, [sdk, token]);

  // Initial check + polling fallback
  useEffect(() => {
    if (disabled) return;
    checkUnread();
    const t = setInterval(checkUnread, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [disabled, checkUnread]);

  // Realtime subscription (best-effort)
  useEffect(() => {
    if (disabled) return;
    if (!supabase || !companyId) return;
    if (!sdk?.activity?.getRealtimeChannel) return;
    const channel = sdk.activity.getRealtimeChannel({
      supabase,
      companyId,
      onInsert: (row) => {
        // Normalize Supabase snake_case payload to camelCase
        const normalized = {
          id: row.id,
          companyId: row.company_id,
          actorId: row.actor_id,
          type: row.type,
          entityType: row.entity_type,
          entityId: row.entity_id,
          summary: row.summary,
          payload: row.payload,
          link: row.link,
          severity: row.severity,
          source: row.source,
          createdAt: row.created_at,
          actor: null,
        };
        setNewActivity(normalized);
        setHasUnread(true);
      },
    });
    if (!channel) return;
    try {
      channel.subscribe();
    } catch {
      // fallback to polling already handled
    }
    return () => {
      try {
        supabase.removeChannel?.(channel);
      } catch {}
    };
  }, [disabled, sdk, supabase, companyId]);

  function handleOpen() {
    setOpen(true);
    setRefreshKey((k) => k + 1);
    const now = new Date();
    lastSeenRef.current = now;
    writeLastSeen(now);
    setHasUnread(false);
  }

  if (disabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
        title="Actividad"
        aria-label="Abrir actividad reciente"
      >
        <ActivityIcon size={16} />
        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[hsl(var(--background))]" />
        )}
      </button>
      <ActivityDrawer
        open={open}
        onClose={() => setOpen(false)}
        sdk={sdk}
        token={token}
        newActivity={newActivity}
        refreshKey={refreshKey}
        onNavigate={onNavigate}
        onSeeAll={onSeeAll}
      />
    </>
  );
}

export default ActivityBellTrigger;
