import { useEffect } from "react";
import { X } from "lucide-react";
import { ActivityTimeline } from "./ActivityTimeline.jsx";

/**
 * <ActivityDrawer />
 * Slide-in drawer attached to the right side of the viewport.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - sdk, token: forwarded to ActivityTimeline
 *  - newActivity?: object (used by realtime to prepend)
 *  - onNavigate?: (href) => void
 *  - onSeeAll?: () => void  -> footer "Ver todo →" click
 */
export function ActivityDrawer({
  open,
  onClose,
  sdk,
  token,
  newActivity = null,
  refreshKey = 0,
  onNavigate,
  onSeeAll,
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && open) onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm transition-opacity ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Actividad reciente"
        className={`fixed top-0 right-0 z-61 h-dvh w-[min(420px,92vw)] bg-[hsl(var(--background))] border-l border-[hsl(var(--border))] shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border))]">
          <h2 className="text-sm font-semibold">Actividad reciente</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-hidden">
          <ActivityTimeline
            sdk={sdk}
            token={token}
            limit={30}
            newActivity={newActivity}
            refreshKey={refreshKey}
            onNavigate={onNavigate}
            heightClass="h-full"
          />
        </div>
        {onSeeAll && (
          <footer className="border-t border-[hsl(var(--border))] p-3">
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onSeeAll?.();
              }}
              className="w-full inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-(--atlas-cyan) hover:bg-[hsl(var(--muted))]"
            >
              Ver todo →
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}

export default ActivityDrawer;
