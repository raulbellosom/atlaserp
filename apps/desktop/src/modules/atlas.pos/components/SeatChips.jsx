import { Plus } from "lucide-react";
import { Button } from "@atlas/ui";

// Horizontal seat selector. guests: [{id,label}], activeSeatId: uuid|null (null = Compartido)
export default function SeatChips({ guests = [], activeSeatId, onSelect, onAddGuest, addingGuest }) {
  const chip = (selected) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
      selected
        ? "border-transparent bg-foreground text-background"
        : "border-border bg-background text-foreground hover:bg-muted"
    }`;
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 [-webkit-overflow-scrolling:touch]">
      <button type="button" className={chip(activeSeatId === null)} onClick={() => onSelect(null)}>
        Compartido
      </button>
      {guests.map((g) => (
        <button key={g.id} type="button" className={chip(activeSeatId === g.id)} onClick={() => onSelect(g.id)}>
          {g.label}
        </button>
      ))}
      <Button variant="outline" size="sm" className="shrink-0 rounded-full px-2.5" onClick={onAddGuest} disabled={addingGuest} title="Agregar comensal">
        <Plus size={14} />
      </Button>
    </div>
  );
}
