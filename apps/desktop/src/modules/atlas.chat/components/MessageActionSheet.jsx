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
  anchorPoint,        // {x,y} for desktop right-click
  anchorRect,         // the pressed message row's DOMRect — mobile popover anchor
  isOwn = false,      // right-align the mobile popover for own messages
  actionProps,        // args for buildMessageActions (minus onReact)
  onQuickReact,       // (emoji) => void
  onOpenFullPicker,   // () => void
}) {
  const isMobile = useIsMobile();
  const actions = buildMessageActions({ ...actionProps, onReact: undefined });
  const primary = actions.filter((a) => a.group === "primary");
  const danger = actions.filter((a) => a.group === "danger");

  // Mobile popover placement — the reaction pill sits just above the pressed
  // bubble, the action card just below it (flipped above when there's no room),
  // both side-aligned to the bubble and clamped to the viewport.
  const pillRef = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!isMobile || !open) { setPos(null); return; }
    const panel = panelRef.current;
    const pill = pillRef.current;
    if (!panel || !pill) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 8;
    const gap = 8;
    const pw = panel.getBoundingClientRect().width;
    const ph = panel.getBoundingClientRect().height;
    const pillW = pill.getBoundingClientRect().width;
    const pillH = pill.getBoundingClientRect().height;

    const rect = anchorRect ?? { top: vh / 2 - 20, bottom: vh / 2 + 20, left: m, right: vw - m };
    // Horizontal: hug the bubble's side.
    const clampX = (x, w) => Math.max(m, Math.min(x, vw - w - m));
    const panelLeft = isOwn ? clampX(rect.right - pw, pw) : clampX(rect.left, pw);
    const pillLeft = isOwn ? clampX(rect.right - pillW, pillW) : clampX(rect.left, pillW);

    // Vertical: card below the bubble, or above if it would overflow.
    const belowTop = rect.bottom + gap;
    const flip = belowTop + ph > vh - m;
    const panelTop = flip
      ? Math.max(m + pillH + gap, rect.top - gap - ph)
      : Math.min(belowTop, vh - ph - m);
    const pillTop = flip
      ? Math.max(m, panelTop - gap - pillH)
      : Math.max(m, rect.top - gap - pillH);

    setPos({ panelLeft, panelTop, pillLeft, pillTop });
  }, [isMobile, open, anchorRect, isOwn]);

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
    const surface =
      "bg-[hsl(var(--popover,var(--card)))] text-[hsl(var(--popover-foreground,var(--foreground)))] border border-[hsl(var(--border))] shadow-2xl";
    return createPortal(
      <div className="fixed inset-0 z-200" role="dialog" aria-label="Acciones del mensaje">
        {/* Dimmed, lightly-blurred scrim — tap anywhere to dismiss. */}
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => onOpenChange(false)}
          className="absolute inset-0 bg-black/50 backdrop-blur-[3px] motion-safe:animate-in motion-safe:fade-in"
        />

        {/* Quick-reaction pill, just above the pressed bubble */}
        <div
          ref={pillRef}
          style={{
            position: "fixed",
            left: pos?.pillLeft ?? -9999,
            top: pos?.pillTop ?? -9999,
            visibility: pos ? "visible" : "hidden",
          }}
          className={[
            "rounded-full px-1 flex items-center gap-0.5",
            surface,
            armed ? "" : "pointer-events-none",
          ].join(" ")}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { onOpenChange(false); onQuickReact?.(emoji); }}
              className="h-10 w-9 text-xl flex items-center justify-center rounded-full active:scale-90 transition"
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            aria-label="Mas emojis"
            onClick={() => { onOpenChange(false); onOpenFullPicker?.(); }}
            className="h-10 w-9 flex items-center justify-center rounded-full text-[hsl(var(--muted-foreground))]"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Action card, just below (or above) the pressed bubble */}
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left: pos?.panelLeft ?? -9999,
            top: pos?.panelTop ?? -9999,
            visibility: pos ? "visible" : "hidden",
          }}
          className={[
            "w-60 max-w-[calc(100vw-16px)] rounded-2xl overflow-hidden py-1",
            surface,
            armed ? "" : "pointer-events-none",
          ].join(" ")}
        >
          {primary.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => runAction(a)}
              className="w-full flex items-center px-4 py-3 text-sm text-left active:bg-[hsl(var(--muted))]"
            >
              <a.icon className="h-4 w-4 mr-3 shrink-0" />{a.label}
            </button>
          ))}
          {primary.length > 0 && danger.length > 0 && <div className="h-px bg-[hsl(var(--border))] my-1" />}
          {danger.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => runAction(a)}
              className={[
                "w-full flex items-center px-4 py-3 text-sm text-left active:bg-[hsl(var(--muted))]",
                a.danger ? "text-red-500" : "",
              ].join(" ")}
            >
              <a.icon className="h-4 w-4 mr-3 shrink-0" />{a.label}
            </button>
          ))}
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
