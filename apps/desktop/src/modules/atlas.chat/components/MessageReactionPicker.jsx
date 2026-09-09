import { Popover, PopoverAnchor, PopoverContent, Sheet, SheetContent, SheetHeader, SheetTitle, useCoarsePointer } from "@atlas/ui";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";

// The full emoji picker for choosing a reaction outside the quick set. On a
// coarse pointer (phone) it opens as a bottom Sheet — WhatsApp-style, and the
// same pattern MessageComposer.jsx already uses for its own "+" — because a
// body-portaled Popover anchored to a bubble mispositions on small viewports
// (spilled off the top / behind the status bar). On desktop it stays a Radix
// Popover anchored beside the bubble.
//
// Opened externally (from the "+" in MessageActionSheet's quick-reaction pill),
// so `children` is the bubble-column element the desktop popover anchors to and
// must always render in place. `onPick(emoji)` receives the plain character.
const PICKER_PROPS = {
  theme: "dark",
  emojiStyle: EmojiStyle.NATIVE,
  searchPlaceholder: "Buscar emoji...",
  lazyLoadEmojis: true,
  skinTonesDisabled: true,
  autoFocusSearch: false,
};

export function MessageReactionPicker({ open, onOpenChange, onPick, anchorAlign = "start", children }) {
  const coarse = useCoarsePointer();

  if (coarse) {
    return (
      <>
        {children}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="p-0 gap-0" style={{ zIndex: 10001 }}>
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle>Reaccionar</SheetTitle>
            </SheetHeader>
            <div className="px-2 pb-2">
              <EmojiPicker
                {...PICKER_PROPS}
                onEmojiClick={(d) => { onPick(d.emoji); onOpenChange(false); }}
                width="100%"
                height="min(48vh, 400px)"
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        side={anchorAlign === "end" ? "left" : "right"}
        align="start"
        sideOffset={8}
        // Keep the picker fully on-screen on narrow windows — without this the
        // fixed-width emoji panel spills past the viewport edge next to a wide
        // message bubble.
        collisionPadding={8}
        // pointer-events-auto + explicit high z-index: when opened from inside a
        // modal Sheet/Dialog (ThreadPanel "Hilo"), Radix Dialog sets
        // `pointer-events: none` on <body> and this Popover portals as a sibling.
        className="w-auto p-0 overflow-hidden pointer-events-auto"
        style={{ zIndex: 10001 }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <EmojiPicker
          {...PICKER_PROPS}
          onEmojiClick={(emojiData) => { onPick(emojiData.emoji); onOpenChange(false); }}
          width="min(92vw, 300px)"
          height="min(60vh, 320px)"
        />
      </PopoverContent>
    </Popover>
  );
}
