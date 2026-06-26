import { useState, useRef, useCallback } from "react";
import { Button } from "@atlas/ui";
import { Send, Paperclip } from "lucide-react";

export function MessageComposer({ onSend, onTyping, disabled, placeholder = "Escribe un mensaje..." }) {
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const typingTimeout = useRef(null);
  const isTypingRef = useRef(false);

  const handleChange = useCallback(
    (e) => {
      setBody(e.target.value);

      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping?.(true);
      }

      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        isTypingRef.current = false;
        onTyping?.(false);
      }, 2000);
    },
    [onTyping],
  );

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || isSending) return;

    clearTimeout(typingTimeout.current);
    isTypingRef.current = false;
    onTyping?.(false);
    setIsSending(true);

    try {
      await onSend({ body: trimmed, messageType: "text" });
      setBody("");
    } finally {
      setIsSending(false);
    }
  }, [body, isSending, onSend, onTyping]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="border-t border-[hsl(var(--border))] px-4 py-3">
      <div className="flex items-end gap-2 bg-[hsl(var(--muted))] rounded-2xl px-3 py-2">
        <button
          type="button"
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mb-0.5"
          title="Adjuntar archivo (proximamente)"
          disabled={disabled}
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <textarea
          className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-[hsl(var(--muted-foreground))] min-h-[20px] max-h-32 py-0.5"
          rows={1}
          placeholder={placeholder}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSending}
          style={{ height: "auto" }}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
          }}
        />

        <Button
          size="sm"
          className="shrink-0 rounded-full h-8 w-8 p-0"
          onClick={handleSend}
          disabled={!body.trim() || isSending || disabled}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 ml-1">
        Intro para enviar · Shift+Intro para nueva linea
      </p>
    </div>
  );
}
