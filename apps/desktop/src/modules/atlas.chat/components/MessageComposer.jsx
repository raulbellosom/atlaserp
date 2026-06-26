import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@atlas/ui";
import { Send, Paperclip, Smile } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

export function MessageComposer({ onSend, onTyping, disabled, placeholder = "Escribe un mensaje..." }) {
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef(null);
  const emojiContainerRef = useRef(null);
  const typingTimeout = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!showEmoji) return;
    function handlePointerDown(e) {
      if (!emojiContainerRef.current?.contains(e.target)) {
        setShowEmoji(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showEmoji]);

  const insertEmoji = useCallback((emojiData) => {
    const emoji = emojiData.emoji;
    const textarea = textareaRef.current;
    if (!textarea) {
      setBody((prev) => prev + emoji);
      return;
    }
    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const newBody = body.slice(0, start) + emoji + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + emoji.length;
      textarea.setSelectionRange(pos, pos);
    });
  }, [body]);

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
    setShowEmoji(false);

    try {
      await onSend({ body: trimmed, messageType: "text" });
      setBody("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
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
    <div className="border-t border-[hsl(var(--border))] px-3 py-2 sm:px-4 sm:py-3 relative shrink-0">
      {showEmoji && (
        <div
          ref={emojiContainerRef}
          className="absolute bottom-full left-3 sm:left-4 mb-2 z-50 shadow-xl rounded-xl overflow-hidden"
        >
          <EmojiPicker
            onEmojiClick={insertEmoji}
            theme="dark"
            width={300}
            height={360}
            searchPlaceholder="Buscar emoji..."
            lazyLoadEmojis
            skinTonesDisabled
          />
        </div>
      )}

      <div className="flex items-center gap-1.5 bg-[hsl(var(--muted))] rounded-2xl px-2.5 py-2">
        <button
          type="button"
          className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))] transition-colors touch-manipulation"
          title="Adjuntar archivo (proximamente)"
          disabled={disabled}
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <textarea
          ref={textareaRef}
          className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-[hsl(var(--muted-foreground))] min-h-9 max-h-32 py-2 leading-tight"
          rows={1}
          placeholder={placeholder}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSending}
          style={{ height: "36px" }}
          onInput={(e) => {
            e.target.style.height = "36px";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
          }}
        />

        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          disabled={disabled}
          className={[
            "shrink-0 h-8 w-8 flex items-center justify-center rounded-full transition-colors touch-manipulation",
            showEmoji
              ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))]",
          ].join(" ")}
          title="Emojis"
        >
          <Smile className="h-4 w-4" />
        </button>

        <Button
          size="sm"
          className="shrink-0 rounded-full h-8 w-8 p-0 touch-manipulation"
          onClick={handleSend}
          disabled={!body.trim() || isSending || disabled}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 ml-1 hidden sm:block">
        Intro para enviar · Shift+Intro para nueva linea
      </p>
    </div>
  );
}
