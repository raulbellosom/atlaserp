import { Hand, X } from "lucide-react";
import { raiseOrder } from "./lib/callEphemeral.js";

// Host-only ordered list of raised hands, top-left of the video area. Hidden
// when nobody has their hand up. Non-hosts rely on the per-tile badge only.
export function RaisedHandsBar({ raisedHands, onLower }) {
  const hands = raiseOrder(raisedHands);
  if (hands.length === 0) return null;
  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-w-[70%] flex-col gap-0.5 rounded-xl bg-black/55 p-1.5 backdrop-blur">
      {hands.map((h, i) => (
        <div
          key={h.identity}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-white hover:bg-white/10"
        >
          <Hand className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span className="min-w-0 max-w-[9rem] truncate">{i + 1}. {h.name ?? "Participante"}</span>
          <button
            type="button"
            onClick={() => onLower?.(h.identity)}
            title="Bajar la mano"
            className="ml-0.5 shrink-0 rounded p-0.5 text-white/55 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
