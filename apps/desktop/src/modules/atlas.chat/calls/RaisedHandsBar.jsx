import { Hand, X } from "lucide-react";
import { raiseOrder } from "./lib/callEphemeral.js";

// Host-only ordered list of raised hands, top-left of the video area. Hidden
// when nobody has their hand up. Non-hosts rely on the per-tile badge only.
export function RaisedHandsBar({ raisedHands, onLower }) {
  const hands = raiseOrder(raisedHands);
  if (hands.length === 0) return null;
  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-w-[70%] flex-col gap-1">
      {hands.map((h, i) => (
        <div
          key={h.identity}
          className="flex items-center gap-1.5 rounded-full bg-amber-400/95 px-2.5 py-1 text-xs font-medium text-amber-950 shadow"
        >
          <Hand className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 max-w-[9rem] truncate">{i + 1}. {h.name ?? "Participante"}</span>
          <button
            type="button"
            onClick={() => onLower?.(h.identity)}
            title="Bajar la mano"
            className="ml-0.5 shrink-0 rounded-full p-0.5 hover:bg-amber-950/15"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
