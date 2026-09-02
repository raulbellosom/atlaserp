// apps/desktop/src/modules/atlas.pfm/components/AssistantThreadList.jsx
import { useState } from "react";
import { Button, ConfirmDialog } from "@atlas/ui";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import {
  useAssistantThreads,
  useCreateAssistantThread,
  useDeleteAssistantThread,
} from "../hooks/use-pfm-assistant";
import { threadTitle } from "../lib/assistant-format";

export function AssistantThreadList({ activeId, onSelect }) {
  const { data: threads = [] } = useAssistantThreads();
  const createMut = useCreateAssistantThread();
  const deleteMut = useDeleteAssistantThread();
  const [removeTarget, setRemoveTarget] = useState(null);

  return (
    <div className="border-b border-[hsl(var(--border))] p-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={async () => {
            const res = await createMut.mutateAsync();
            onSelect(res?.data?.id ?? res?.id ?? null);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Nueva
        </Button>
      </div>
      {threads.length > 0 && (
        <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto">
          {threads.map((t) => (
            <li key={t.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                className={[
                  "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs",
                  t.id === activeId
                    ? "bg-[hsl(var(--muted))] font-medium"
                    : "hover:bg-[hsl(var(--muted))]",
                ].join(" ")}
              >
                <MessageSquare className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                <span className="truncate">{threadTitle(t.title)}</span>
              </button>
              <button
                type="button"
                aria-label="Borrar"
                onClick={() => setRemoveTarget(t)}
                className="shrink-0 rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(v) => !v && setRemoveTarget(null)}
        title="Borrar conversacion"
        description="Se elimina esta conversacion y sus mensajes."
        confirmLabel="Borrar"
        onConfirm={async () => {
          await deleteMut.mutateAsync(removeTarget.id);
          if (removeTarget.id === activeId) onSelect(null);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}
