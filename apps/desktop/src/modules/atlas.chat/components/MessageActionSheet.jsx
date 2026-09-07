import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  useIsMobile,
} from "@atlas/ui";
import { Plus } from "lucide-react";
import { buildMessageActions, QUICK_REACTIONS } from "../lib/messageActions";

// Unified action surface. Mobile: an anchored popover over the pressed message
// (iMessage/Telegram style) raised by long-press. Desktop: DropdownMenu at the
// cursor, raised by right-click. Both render the same quick-reaction row +
// buildMessageActions() list. The desktop hover menu (MessageActions in
// ChatMessageBubble) is separate and unchanged.
export function MessageActionSheet({
  open,
  onOpenChange,
  anchorPoint,        // {x,y} for desktop right-click; null on mobile long-press
  actionProps,        // args for buildMessageActions (minus onReact)
  onQuickReact,       // (emoji) => void
  onOpenFullPicker,   // () => void
}) {
  const isMobile = useIsMobile();
  const actions = buildMessageActions({ ...actionProps, onReact: undefined });
  const primary = actions.filter((a) => a.group === "primary");
  const danger = actions.filter((a) => a.group === "danger");

  // Mobile popover placement — measured against the press point, clamped to
  // the viewport, flipped above the point when it would overflow the bottom.
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!isMobile || !open) { setPos(null); return; }
    const el = panelRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 8;
    const ax = anchorPoint?.x ?? vw / 2;
    const ay = anchorPoint?.y ?? vh / 2;
    let left = ax - width / 2;
    left = Math.max(m, Math.min(left, vw - width - m));
    let top = ay + 10;
    if (top + height > vh - m) top = ay - height - 10;
    top = Math.max(m, Math.min(top, vh - height - m));
    setPos({ left, top });
  }, [isMobile, open, anchorPoint?.x, anchorPoint?.y]);

  useEffect(() => {
    if (!isMobile || !open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, open, onOpenChange]);

  // The desktop/tablet menu opens at the finger while it's still pressed from
  // the long-press. Ignore pointer input on the menu for a moment so the lift
  // that ends the long-press can't immediately activate the item under it
  // (which used to fire "Seleccionar" and drop the list into selection mode).
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!open) { setArmed(false); return undefined; }
    const t = setTimeout(() => setArmed(true), 400);
    return () => clearTimeout(t);
  }, [open]);

  function runAction(a) {
    onOpenChange(false);
    a.onSelect?.();
  }

  const quickRow = (small) => (
    <div className={small ? "flex items-center gap-0.5 px-1 py-1" : "flex items-center justify-between gap-1 px-2 py-2"}>
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => { onOpenChange(false); onQuickReact?.(emoji); }}
          className={[
            "rounded-full flex items-center justify-center hover:bg-[hsl(var(--muted))] active:scale-90 transition",
            small ? "h-7 w-7 text-base" : "h-10 w-10 text-xl",
          ].join(" ")}
        >
          {emoji}
        </button>
      ))}
      <button
        type="button"
        aria-label="Mas emojis"
        onClick={() => { onOpenChange(false); onOpenFullPicker?.(); }}
        className={[
          "rounded-full flex items-center justify-center hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
          small ? "h-7 w-7" : "h-10 w-10",
        ].join(" ")}
      >
        <Plus className={small ? "h-4 w-4" : "h-5 w-5"} />
      </button>
    </div>
  );

  if (isMobile) {
    if (!open) return null;
    return createPortal(
      <div className="fixed inset-0 z-59" role="dialog" aria-label="Acciones del mensaje">
        {/* Scrim — tap to dismiss; the pressed bubble is raised above it by
            ChatMessageBubble while actionSheet.open. */}
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => onOpenChange(false)}
          className="absolute inset-0 bg-black/40"
        />
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left: pos?.left ?? -9999,
            top: pos?.top ?? -9999,
            visibility: pos ? "visible" : "hidden",
          }}
          className={[
            "chat-glass-theme chat-glass w-64 max-w-[calc(100vw-16px)] rounded-2xl overflow-hidden shadow-xl",
            armed ? "" : "pointer-events-none",
          ].join(" ")}
        >
          {quickRow(false)}
          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="py-1">
            {primary.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => runAction(a)}
                className="w-full flex items-center px-4 py-3 text-sm text-left hover:bg-[hsl(var(--muted))]"
              >
                <a.icon className="h-4 w-4 mr-3" />{a.label}
              </button>
            ))}
            {primary.length > 0 && danger.length > 0 && <div className="h-px bg-[hsl(var(--border))] my-1" />}
            {danger.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => runAction(a)}
                className={[
                  "w-full flex items-center px-4 py-3 text-sm text-left hover:bg-[hsl(var(--muted))]",
                  a.danger ? "text-red-500" : "",
                ].join(" ")}
              >
                <a.icon className="h-4 w-4 mr-3" />{a.label}
              </button>
            ))}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // Desktop right-click: anchor a DropdownMenu at the cursor via a fixed 0-size
  // trigger. The trigger span is portaled to <body> so it escapes the chat's
  // `zoom` (--chat-zoom font scale) and `backdrop-filter` (.chat-glass)
  // subtree — inside either of those, `position: fixed` coordinates are
  // remapped/scaled by Chromium, which is why the menu used to open offset
  // from the actual click point. createPortal keeps the Radix Root context
  // intact even though the DOM node lands elsewhere.
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {createPortal(
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            style={{ position: "fixed", left: anchorPoint?.x ?? 0, top: anchorPoint?.y ?? 0, width: 0, height: 0 }}
          />
        </DropdownMenuTrigger>,
        document.body,
      )}
      <DropdownMenuContent
        align="start"
        style={{ zIndex: 10000 }}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={armed ? undefined : "pointer-events-none"}
      >
        {quickRow(true)}
        <DropdownMenuSeparator />
        {primary.map((a) => (
          <DropdownMenuItem key={a.key} onSelect={() => runAction(a)}>
            <a.icon className="h-3.5 w-3.5 mr-2" />{a.label}
          </DropdownMenuItem>
        ))}
        {primary.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
        {danger.map((a) => (
          <DropdownMenuItem
            key={a.key}
            onSelect={() => runAction(a)}
            className={a.danger ? "text-red-500 focus:text-red-500" : undefined}
          >
            <a.icon className="h-3.5 w-3.5 mr-2" />{a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
