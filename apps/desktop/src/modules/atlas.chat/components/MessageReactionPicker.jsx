import { Popover, PopoverAnchor, PopoverContent } from "@atlas/ui";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";

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
  // Opens to the side of the message bubble instead of above/below it — for
  // an own (right-aligned, anchorAlign="end") message that means to its
  // left, toward the center of the column; for a received (left-aligned,
  // anchorAlign="start") message, to its right. Radix still auto-flips to
  // the opposite side on its own if that side has no room (e.g. a very
  // narrow viewport), so this is the preferred side, not the only one.
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        side={anchorAlign === "end" ? "left" : "right"}
        align="start"
        sideOffset={8}
        className="w-auto p-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <EmojiPicker
          onEmojiClick={(emojiData) => { onPick(emojiData.emoji); onOpenChange(false); }}
          theme="dark"
          // Render native OS emoji so the picker matches the reaction pills,
          // the quick-reaction row and composed message text (all native
          // Unicode). The library's default is an Apple image sprite, which
          // reads as a different emoji set from what actually lands.
          emojiStyle={EmojiStyle.NATIVE}
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
