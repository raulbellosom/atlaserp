import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCoarsePointer, useOfficeActions } from "@atlas/ui";
import { Plus } from "lucide-react";
import { buildMessageActions, QUICK_REACTIONS } from "../lib/messageActions";
import { computeActionSheetLayout } from "../lib/messageActionLayout";
import { useAttachmentUrl, buildAttachmentActions } from "./MessageAttachments";

// Unified action surface for a message — one popover for every trigger:
//   - touch long-press: dimmed + blurred backdrop with a sharp "window" over
//     the pressed bubble (WhatsApp/Telegram), reaction pill above, action card
//     below; a short arm delay so the finger-lift doesn't activate an item.
//   - mouse right-click: the same card anchored at the cursor with an invisible
//     click-catcher for dismiss, live on the first click.
// No Radix menu here — a programmatically-opened Radix DropdownMenu under the
// cursor swallowed the first click.
export function MessageActionSheet({
  open,
  onOpenChange,
  anchorPoint,        // {x,y} — mouse right-click position
  anchorRect,         // pressed message row's / attachment's DOMRect
  attachment,         // the attachment tile that was pressed, if any
  isOwn = false,      // hug the bubble's side on touch
  actionProps,        // args for buildMessageActions (minus onReact)
  onQuickReact,       // (emoji) => void
  onOpenFullPicker,   // () => void
  onBubbleShift,      // (dy:number) => void — ChatMessageBubble translates the row so the stack fits the safe area
}) {
  const coarse = useCoarsePointer();
  const actions = buildMessageActions({ ...actionProps, onReact: undefined });
  const primary = actions.filter((a) => a.group === "primary");
  const danger = actions.filter((a) => a.group === "danger");
  // Attachment actions (copy image / copy link / download / open) merged into
  // the same menu when an image/file tile was the press target. useAttachmentUrl
  // is safe to call with undefined — it just stays disabled.
  const { data: attUrl } = useAttachmentUrl(attachment ?? undefined);
  const office = useOfficeActions();
  const attachmentActions = attachment ? buildAttachmentActions({ att: attachment, url: attUrl, office }) : [];

  const pillRef = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); onBubbleShift?.(0); return; }
    const panel = panelRef.current;
    const pill = pillRef.current;
    if (!panel || !pill) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(rootStyle.getPropertyValue("--safe-top")) || 0;
    const safeBottom = parseFloat(rootStyle.getPropertyValue("--safe-bottom")) || 0;

    const pr = panel.getBoundingClientRect();
    const plr = pill.getBoundingClientRect();

    const layout = computeActionSheetLayout({
      vw: window.innerWidth,
      vh: window.innerHeight,
      rect: anchorRect ?? null,
      anchorPoint: (!coarse && anchorPoint) ? anchorPoint : null,
      pillSize: { width: plr.width, height: plr.height },
      panelSize: { width: pr.width, height: pr.height },
      coarse,
      isOwn,
      safeTop,
      safeBottom,
      gap: 8,
      margin: 8,
    });

    setPos({
      panelLeft: layout.panelLeft,
      panelTop: layout.panelTop,
      pillLeft: layout.pillLeft,
      pillTop: layout.pillTop,
      sRect: layout.sRect,
    });
    onBubbleShift?.(layout.shiftY);
  }, [open, anchorRect, anchorPoint, isOwn, coarse, attachmentActions.length, primary.length, danger.length, onBubbleShift]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Touch only: the popover opens while the finger is still down from the
  // long-press, so ignore pointer input on it for a beat — otherwise the lift
  // that ends the long-press activates whatever item is under it. A mouse
  // right-click produces no such synthetic click, so it stays live immediately.
  const [armed, setArmed] = useState(!coarse);
  useEffect(() => {
    if (!coarse) { setArmed(true); return undefined; }
    if (!open) { setArmed(false); return undefined; }
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 220);
    return () => clearTimeout(t);
  }, [open, coarse]);

  if (!open) return null;

  function runAction(a) {
    if (a.disabled) return;
    onOpenChange(false);
    a.onSelect?.();
  }
  const close = () => onOpenChange(false);

  const surface = "glass-strong text-[hsl(var(--popover-foreground,var(--foreground)))] shadow-lg";
  const gate = armed ? "" : "pointer-events-none";

  const r = pos?.sRect ?? anchorRect;
  const scrim = "bg-black/55 backdrop-blur-[3px]";

  const menuItem = (a, extra = "") => (
    <button
      key={a.key}
      type="button"
      disabled={a.disabled}
      onClick={() => runAction(a)}
      className={[
        "w-full flex items-center px-4 py-2.5 text-[13px] text-left hover:bg-[hsl(var(--muted))] active:bg-[hsl(var(--muted))] disabled:opacity-40 disabled:hover:bg-transparent",
        extra,
      ].join(" ")}
    >
      <a.icon className="h-4 w-4 mr-3 shrink-0" />{a.label}
    </button>
  );

  return createPortal(
    <div
      data-msg-action-menu
      className="fixed inset-0 z-200"
      role="dialog"
      aria-label="Acciones del mensaje"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Dismiss layer. Touch: dim + blur everything except a sharp window over
          the pressed bubble. Mouse: an invisible full-screen click catcher. */}
      {coarse && r ? (
        <>
          {/* Transparent catcher over the spotlighted bubble — WhatsApp
              dismisses on a tap anywhere that isn't an action. */}
          <button type="button" aria-label="Cerrar" onClick={close}
            className="absolute"
            style={{ top: r.top, left: r.left, width: Math.max(0, r.right - r.left), height: Math.max(0, r.bottom - r.top) }} />
          <button type="button" aria-label="Cerrar" onClick={close}
            className={["absolute left-0 right-0 top-0", scrim].join(" ")}
            style={{ height: Math.max(0, r.top) }} />
          <button type="button" aria-label="Cerrar" onClick={close}
            className={["absolute left-0 right-0 bottom-0", scrim].join(" ")}
            style={{ top: r.bottom }} />
          <button type="button" aria-label="Cerrar" onClick={close}
            className={["absolute left-0", scrim].join(" ")}
            style={{ top: r.top, height: Math.max(0, r.bottom - r.top), width: Math.max(0, r.left) }} />
          <button type="button" aria-label="Cerrar" onClick={close}
            className={["absolute right-0", scrim].join(" ")}
            style={{ top: r.top, height: Math.max(0, r.bottom - r.top), left: r.right }} />
        </>
      ) : (
        <button type="button" aria-label="Cerrar" onClick={close}
          className={["absolute inset-0", coarse ? scrim : ""].join(" ")} />
      )}

      {/* Quick-reaction pill */}
      <div
        ref={pillRef}
        style={{
          position: "fixed",
          left: pos?.pillLeft ?? -9999,
          top: pos?.pillTop ?? -9999,
          visibility: pos ? "visible" : "hidden",
        }}
        className={["rounded-full px-1 flex items-center gap-0.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 duration-100", surface, gate].join(" ")}
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => { close(); onQuickReact?.(emoji); }}
            className="h-9 w-8 text-lg flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] active:scale-90 transition"
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          aria-label="Mas emojis"
          onClick={() => { close(); onOpenFullPicker?.(); }}
          className="h-9 w-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Action card */}
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          left: pos?.panelLeft ?? -9999,
          top: pos?.panelTop ?? -9999,
          visibility: pos ? "visible" : "hidden",
        }}
        className={["w-60 max-w-[calc(100vw-16px)] rounded-xl overflow-hidden py-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 duration-100", surface, gate].join(" ")}
      >
        {primary.map((a) => menuItem(a))}
        {attachmentActions.length > 0 && (
          <>
            <div className="h-px bg-[hsl(var(--border))] my-1" />
            {attachmentActions.map((a) => menuItem(a))}
          </>
        )}
        {primary.length + attachmentActions.length > 0 && danger.length > 0 && (
          <div className="h-px bg-[hsl(var(--border))] my-1" />
        )}
        {danger.map((a) => menuItem(a, a.danger ? "text-red-500" : ""))}
      </div>
    </div>,
    document.body,
  );
}
