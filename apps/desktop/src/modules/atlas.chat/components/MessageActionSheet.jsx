import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  useIsMobile,
} from "@atlas/ui";
import { Plus } from "lucide-react";
import { buildMessageActions, QUICK_REACTIONS } from "../lib/messageActions";

// Unified action surface. Mobile: bottom Sheet raised by long-press. Desktop:
// DropdownMenu at the cursor, raised by right-click. Both render the same
// quick-reaction row + buildMessageActions() list. The desktop hover menu
// (MessageActions in ChatMessageBubble) is separate and unchanged.
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
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="chat-glass-theme p-0 rounded-t-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Acciones del mensaje</SheetTitle>
          </SheetHeader>
          {quickRow(false)}
          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="py-1 pb-[env(safe-area-inset-bottom)]">
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
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop right-click: anchor a DropdownMenu at the cursor via a fixed 0-size trigger.
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          style={{ position: "fixed", left: anchorPoint?.x ?? 0, top: anchorPoint?.y ?? 0, width: 0, height: 0 }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" style={{ zIndex: 10000 }} onCloseAutoFocus={(e) => e.preventDefault()}>
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
