import { Copy, Share2, CheckSquare, Pin, PinOff, Smile, MessageSquare, Trash2, EyeOff, CornerUpLeft } from "lucide-react";

// Single source of truth for the per-message action list. Consumed by the
// desktop hover menu (MessageActions in ChatMessageBubble) and the mobile /
// right-click MessageActionSheet. Each entry:
//   { key, label, icon, onSelect, danger?, group }
// `group` is "primary" | "danger" — drives separator placement.
export function buildMessageActions({
  hasBody, isOwn, canPin, isPinned, canReply,
  onReply, onCopy, onForward, onEnterSelection, onPin, onReact, onOpenThread,
  onDelete, onHideForMe,
}) {
  const items = [];
  if (onReply) items.push({ key: "reply", label: "Responder", icon: CornerUpLeft, onSelect: onReply, group: "primary" });
  if (hasBody && onCopy) items.push({ key: "copy", label: "Copiar", icon: Copy, onSelect: onCopy, group: "primary" });
  if (onForward) items.push({ key: "forward", label: "Reenviar", icon: Share2, onSelect: onForward, group: "primary" });
  if (onEnterSelection) items.push({ key: "select", label: "Seleccionar", icon: CheckSquare, onSelect: onEnterSelection, group: "primary" });
  if (canPin && onPin) items.push({ key: "pin", label: isPinned ? "Desfijar mensaje" : "Fijar mensaje", icon: isPinned ? PinOff : Pin, onSelect: onPin, group: "primary" });
  if (onReact) items.push({ key: "react", label: "Reaccionar", icon: Smile, onSelect: onReact, group: "primary" });
  if (canReply && onOpenThread) items.push({ key: "thread", label: "Responder en hilo", icon: MessageSquare, onSelect: onOpenThread, group: "primary" });
  if (isOwn && onDelete) items.push({ key: "delete", label: "Eliminar para todos", icon: Trash2, onSelect: onDelete, danger: true, group: "danger" });
  if (onHideForMe) items.push({ key: "hide", label: "Eliminar para mi", icon: EyeOff, onSelect: onHideForMe, group: "danger" });
  return items;
}

export const QUICK_REACTIONS = ["\u{1F44D}", "❤️", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"];
