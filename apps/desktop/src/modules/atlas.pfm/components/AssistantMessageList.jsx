// apps/desktop/src/modules/atlas.pfm/components/AssistantMessageList.jsx
import { useEffect, useRef } from "react";
import { EmptyState } from "@atlas/ui";
import { Sparkles } from "lucide-react";
import { AssistantMessage } from "./AssistantMessage";
import { AssistantActionCard } from "./AssistantActionCard";

export function AssistantMessageList({ messages, pending, proposedAction, onProposalDone }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending, proposedAction]);

  if (messages.length === 0 && !pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <EmptyState
          icon={Sparkles}
          variant="compact"
          title="Pregunta sobre tus finanzas"
          description="Ej: cuanto tengo en total, hazme un resumen del mes, en que gaste mas."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-3">
      {messages.map((m, i) => (
        <AssistantMessage key={i} role={m.role} content={m.content} />
      ))}
      {proposedAction && (
        <AssistantActionCard action={proposedAction} onDone={onProposalDone} />
      )}
      {pending && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
            Pensando...
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
