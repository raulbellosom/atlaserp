import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./Sheet.jsx";
import { ActivityTimeline } from "./ActivityTimeline.jsx";

/**
 * <ActivityDrawer />
 * Slide-in drawer attached to the right side of the viewport (becomes a
 * bottom sheet on mobile via the shared `Sheet` primitive).
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
  onSelect,
  onNavigate,
  onSeeAll,
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose?.(); }}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-[min(420px,92vw)] sm:max-w-105 p-0 gap-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b border-[hsl(var(--border))]">
          <SheetTitle>Actividad reciente</SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ActivityTimeline
            sdk={sdk}
            token={token}
            limit={30}
            newActivity={newActivity}
            refreshKey={refreshKey}
            onSelect={onSelect}
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
      </SheetContent>
    </Sheet>
  );
}

export default ActivityDrawer;
