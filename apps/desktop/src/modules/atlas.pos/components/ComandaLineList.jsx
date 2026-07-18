import { useMemo } from "react";
import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@atlas/ui";

// Groups hydrated order lines by guestSeatId into per-guest sections, with
// "Compartido" (guestSeatId === null) always rendered last.
export default function ComandaLineList({ order, onEditLine }) {
  const sections = useMemo(() => {
    const lines = order?.lines ?? [];
    const guests = order?.guests ?? [];
    const byGuest = new Map();
    for (const guest of guests) byGuest.set(guest.id, { id: guest.id, label: guest.label, lines: [] });
    const shared = { id: null, label: "Compartido", lines: [] };

    for (const line of lines) {
      const seatId = line.guestSeatId ?? null;
      if (seatId === null) {
        shared.lines.push(line);
        continue;
      }
      if (!byGuest.has(seatId)) byGuest.set(seatId, { id: seatId, label: "Comensal", lines: [] });
      byGuest.get(seatId).lines.push(line);
    }

    const guestSections = [...byGuest.values()].filter((s) => s.lines.length > 0);
    return shared.lines.length > 0 ? [...guestSections, shared] : guestSections;
  }, [order]);

  const totalLines = order?.lines?.length ?? 0;

  if (totalLines === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Agrega productos para comenzar"
        description="Toca un producto de la lista para agregarlo a la comanda."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.id ?? "shared"} className="flex flex-col gap-1.5">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.label}
          </p>
          <div className="flex flex-col gap-1.5">
            {section.lines.map((line) => (
              <button
                key={line.id}
                type="button"
                onClick={() => onEditLine(line)}
                className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left shadow-sm active:scale-[0.99] transition-transform touch-manipulation"
              >
                <span className="mt-0.5 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {parseFloat(line.quantity ?? 0)}×
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight truncate">{line.productName}</p>
                  {(line.modifiers ?? []).map((mod, i) => (
                    <p key={i} className="text-xs text-muted-foreground leading-tight">
                      · {mod.optionName}
                    </p>
                  ))}
                  {line.note && (
                    <p className="text-xs italic text-muted-foreground leading-tight mt-0.5">{line.note}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  ${parseFloat(line.totalAmount ?? 0).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
