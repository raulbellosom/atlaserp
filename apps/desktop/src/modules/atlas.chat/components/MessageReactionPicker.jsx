import { Popover, PopoverAnchor, PopoverContent } from "@atlas/ui";
import EmojiPicker from "emoji-picker-react";

// A minimal popover wrapping the same EmojiPicker MessageComposer.jsx already
// uses for its own emoji button — same library, same visual language, not a
// reimplementation. Uses @atlas/ui's Popover (Radix, portaled to <body>) so it
// stays fully visible and correctly positioned regardless of where the message
// sits inside ChatMessageList's scrolling container — a hand-rolled `absolute`
// div here would get clipped by that ancestor's overflow-y-auto for messages
// near the top or bottom of the visible scrollport.
//
// Opened externally (from the "Reaccionar" item in MessageActions' dropdown,
// not by clicking the popover's own anchor), so this uses PopoverAnchor
// (an invisible reference point) rather than PopoverTrigger — `children` is
// the bubble-column element the picker should anchor to.
// `onPick(emoji)` receives the plain emoji character.
export function MessageReactionPicker({ open, onOpenChange, onPick, anchorAlign = "start", children }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        align={anchorAlign === "end" ? "end" : "start"}
        side="top"
        className="w-auto p-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
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
      </PopoverContent>
    </Popover>
  );
}
