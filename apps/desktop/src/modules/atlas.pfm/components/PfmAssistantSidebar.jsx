// apps/desktop/src/modules/atlas.pfm/components/PfmAssistantSidebar.jsx
//
// Collapsible right-hand sidebar for the atlas.pfm module. Mounted once by
// ModuleOutlet while moduleKey === "atlas.pfm", so its state (open/closed,
// current thread, in-flight turn) survives navigation between PFM screens.
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@atlas/ui";
import { Sparkles, X } from "lucide-react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import {
  useAssistantStatus,
  useAssistantThread,
  useCreateAssistantThread,
} from "../hooks/use-pfm-assistant";
import { AssistantThreadList } from "./AssistantThreadList";
import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantComposer } from "./AssistantComposer";

const LS_KEY = "pfm.assistant.collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(LS_KEY) !== "0";
  } catch {
    return true;
  }
}
function writeCollapsed(v) {
  try {
    localStorage.setItem(LS_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function errText(err) {
  const m = String(err?.message ?? "");
  if (m.includes("429")) return "Vas muy rapido, espera un momento.";
  if (m.includes("503")) return "El asistente no esta disponible ahora.";
  if (m.includes("502")) return "El asistente no respondio, intenta de nuevo.";
  return "Algo salio mal, intenta de nuevo.";
}

export function PfmAssistantSidebar() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qc = useQueryClient();
  const { data: available, isLoading } = useAssistantStatus();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [threadId, setThreadId] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [proposal, setProposal] = useState(null);

  const { data: thread } = useAssistantThread(threadId);
  const createMut = useCreateAssistantThread();

  useEffect(() => writeCollapsed(collapsed), [collapsed]);

  const messages = useMemo(() => {
    const base = (thread?.messages ?? []).map((m) => ({ role: m.role, content: m.content }));
    if (pendingUser) base.push({ role: "USER", content: pendingUser });
    if (errorMsg) base.push({ role: "ERROR", content: errorMsg });
    return base;
  }, [thread?.messages, pendingUser, errorMsg]);

  async function handleSend(text) {
    setErrorMsg(null);
    setProposal(null);
    setPendingUser(text);
    try {
      let id = threadId;
      if (!id) {
        const res = await createMut.mutateAsync();
        id = res?.data?.id ?? res?.id ?? null;
        setThreadId(id);
      }
      const res = await atlas.pfm.assistant.sendMessage(id, text, token);
      setProposal(res?.data?.proposedAction ?? null);
      qc.invalidateQueries({ queryKey: ["pfm", "assistant", "thread", id] });
      qc.invalidateQueries({ queryKey: ["pfm", "assistant", "threads"] });
    } catch (err) {
      setErrorMsg(errText(err));
    } finally {
      setPendingUser(null);
    }
  }

  if (isLoading || !available) return null;

  const sending = Boolean(pendingUser);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1 rounded-l-lg bg-[hsl(var(--primary))] px-2 py-3 text-[hsl(var(--primary-foreground))] shadow-lg"
        aria-label="Abrir asistente"
      >
        <Sparkles className="h-4 w-4" />
      </button>
    );
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] md:w-[360px]">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" /> Asistente
        </span>
        <Button size="icon" variant="ghost" aria-label="Cerrar" onClick={() => setCollapsed(true)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <AssistantThreadList
        activeId={threadId}
        onSelect={(id) => {
          setThreadId(id);
          setProposal(null);
          setErrorMsg(null);
        }}
      />
      <AssistantMessageList
        messages={messages}
        pending={sending}
        proposedAction={proposal}
        onProposalDone={() => setProposal(null)}
      />
      <AssistantComposer onSend={handleSend} disabled={sending} />
    </aside>
  );
}
