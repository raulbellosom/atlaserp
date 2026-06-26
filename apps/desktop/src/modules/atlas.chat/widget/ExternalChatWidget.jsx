import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Send, ChevronDown } from "lucide-react";
import { saveGuestSession, loadGuestSession } from "../lib/chatUtils";

const POLL_INTERVAL = 5000;

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function StartForm({ onStart, isLoading, error }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onStart({ name: name.trim() || undefined, email: email.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <p className="text-sm text-center text-gray-500">
        Inicia una conversacion con nosotros
      </p>
      <input
        type="text"
        placeholder="Tu nombre (opcional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-violet-500"
      />
      <input
        type="email"
        placeholder="Tu correo (opcional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-violet-500"
      />
      {error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
      >
        {isLoading ? "Iniciando..." : "Iniciar chat"}
      </button>
    </form>
  );
}

function MessageBubble({ msg }) {
  const isOperator = msg.sender_type === "user";
  const isSystem = msg.sender_type === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {msg.body}
        </span>
      </div>
    );
  }

  return (
    <div className={["flex gap-2 my-1", isOperator ? "flex-row" : "flex-row-reverse"].join(" ")}>
      {isOperator && (
        <div className="h-6 w-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-xs font-bold text-violet-600">O</span>
        </div>
      )}
      <div
        className={[
          "max-w-[80%] px-3 py-2 rounded-2xl text-sm",
          isOperator
            ? "bg-gray-100 text-gray-800 rounded-tl-sm"
            : "bg-violet-600 text-white rounded-tr-sm",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        <p className={["text-[10px] mt-0.5", isOperator ? "text-gray-400" : "text-violet-200"].join(" ")}>
          {formatTime(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

/**
 * Embeddable external chat widget for public Atlas websites.
 *
 * Props:
 *   - websiteId: string (optional) UUID of the website in atlas.website
 *   - pageUrl: string (optional) current page URL
 *   - referrer: string (optional) document.referrer
 *   - apiBaseUrl: string (optional) defaults to same origin
 *   - position: "bottom-right" | "bottom-left" (default: "bottom-right")
 *   - primaryColor: string (optional) hex color for widget
 *   - operatorName: string (optional) display name shown in header
 */
export function ExternalChatWidget({
  websiteId,
  pageUrl = typeof window !== "undefined" ? window.location.href : undefined,
  referrer = typeof document !== "undefined" ? document.referrer : undefined,
  apiBaseUrl = "",
  position = "bottom-right",
  primaryColor = "#7c3aed",
  operatorName = "Soporte",
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | starting | chatting | error
  const [sessionToken, setSessionToken] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [startError, setStartError] = useState(null);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  // Restore existing session from localStorage on mount
  useEffect(() => {
    const stored = loadGuestSession();
    if (stored?.token) {
      setSessionToken(stored.token);
      if (stored.session?.conversationId) {
        setConversationId(stored.session.conversationId);
      }
      setPhase("chatting");
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  // Poll for new messages when chat is open
  const fetchMessages = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const resp = await fetch(`${apiBaseUrl}/public/chat/session/${sessionToken}/messages`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data?.data?.length) {
        setMessages(data.data);
        setConversationId(data.conversationId ?? conversationId);
      }
    } catch {}
  }, [sessionToken, apiBaseUrl, conversationId]);

  useEffect(() => {
    if (!open || phase !== "chatting" || !sessionToken) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [open, phase, sessionToken, fetchMessages]);

  async function handleStart({ name, email }) {
    setPhase("starting");
    setStartError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/public/chat/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          email: email || undefined,
          websiteId: websiteId || undefined,
          pageUrl: pageUrl || undefined,
          referrer: referrer || undefined,
          userAgent: navigator.userAgent,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error ?? "Error iniciando chat.");
      }
      const result = await resp.json();
      const { token, conversationId: convId } = result?.data ?? {};
      if (!token) throw new Error("No se recibio token de sesion.");

      setSessionToken(token);
      setConversationId(convId);
      saveGuestSession(token, { conversationId: convId, name, email });
      setPhase("chatting");
    } catch (err) {
      setStartError(err?.message ?? "Error iniciando sesion.");
      setPhase("idle");
    }
  }

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || !sessionToken || isSending) return;
    setIsSending(true);
    const optimistic = {
      id: `opt-${Date.now()}`,
      body: trimmed,
      sender_type: "guest",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");

    try {
      await fetch(`${apiBaseUrl}/public/chat/session/${sessionToken}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      await fetchMessages();
    } catch {}
    setIsSending(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const positionClass =
    position === "bottom-left" ? "bottom-5 left-5" : "bottom-5 right-5";

  return (
    <div className={`fixed ${positionClass} z-50 flex flex-col items-end gap-3`} style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Chat panel */}
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: 460 }}>
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ background: primaryColor }}
          >
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-semibold">{operatorName}</p>
              <p className="text-white/70 text-xs">En linea</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          {phase === "chatting" ? (
            <>
              <div className="flex-1 overflow-y-auto p-3">
                {!messages.length && (
                  <p className="text-center text-xs text-gray-400 mt-4">
                    Un agente te responderá pronto.
                  </p>
                )}
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-gray-100 px-3 py-2 flex items-end gap-2">
                <textarea
                  className="flex-1 text-sm resize-none outline-none placeholder:text-gray-400 py-1 max-h-20"
                  rows={1}
                  placeholder="Escribe un mensaje..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onInput={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`;
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!body.trim() || isSending}
                  className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                  style={{ background: primaryColor }}
                >
                  <Send className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            </>
          ) : (
            <StartForm onStart={handleStart} isLoading={phase === "starting"} error={startError} />
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ background: primaryColor }}
        aria-label="Abrir chat"
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageSquare className="h-6 w-6 text-white" />
        )}
      </button>
    </div>
  );
}
