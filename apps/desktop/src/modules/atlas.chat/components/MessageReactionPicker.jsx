import { useRef, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";

// A minimal popover wrapping the same EmojiPicker MessageComposer.jsx already
// uses for its own emoji button — same library, same visual language, not a
// reimplementation. `onPick(emoji)` receives the plain emoji character.
export function MessageReactionPicker({ open, onOpenChange, onPick, anchorAlign = "start" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className={["absolute bottom-full mb-1 z-50 shadow-xl rounded-xl overflow-hidden", anchorAlign === "end" ? "right-0" : "left-0"].join(" ")}
    >
      <EmojiPicker
        onEmojiClick={(emojiData) => { onPick(emojiData.emoji); onOpenChange(false); }}
        theme="dark"
        width={260}
        height={320}
        searchPlaceholder="Buscar emoji..."
        lazyLoadEmojis
        skinTonesDisabled
        autoFocusSearch={false}
      />
    </div>
  );
}
