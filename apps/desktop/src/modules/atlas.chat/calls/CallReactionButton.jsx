import { Button, Popover, PopoverTrigger, PopoverContent } from "@atlas/ui";
import { SmilePlus } from "lucide-react";
import { QUICK_REACTIONS } from "./lib/callEphemeral.js";

// Footer control: a 6-emoji quick row in a top popover. Shared by the member
// call room and the external guest room.
export function CallReactionButton({ onReact, disabled = false }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={disabled}
          className="h-11 w-11 rounded-full disabled:opacity-40"
          title="Reaccionar"
        >
          <SmilePlus className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-auto rounded-full p-1.5" style={{ zIndex: 60 }}>
        <div className="flex items-center gap-0.5">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onReact?.(e)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:scale-110 hover:bg-[hsl(var(--muted))] active:scale-95"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
