// apps/desktop/src/modules/atlas.pfm/lib/assistant-format.js
//
// Pure helpers for the PFM assistant UI. No React import here — renderRichText
// returns a plain data structure the bubble component turns into elements, so
// it stays testable under node --test and never emits raw HTML.
import { formatMoney } from "./format.js";

export function threadTitle(text) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Nueva conversacion";
  return clean.length > 48 ? clean.slice(0, 48) : clean;
}

// Minimal safe markup: lines -> { bullet, segments:[{text, bold}] }.
// Only **bold** is interpreted; everything else is literal text.
export function renderRichText(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  return lines.map((line) => {
    const bulletMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    const body = bulletMatch ? bulletMatch[1] : line;
    const segments = [];
    const parts = body.split("**");
    parts.forEach((part, i) => {
      if (part === "") return;
      segments.push({ text: part, bold: i % 2 === 1 });
    });
    if (segments.length === 0) segments.push({ text: "", bold: false });
    return { bullet: Boolean(bulletMatch), segments };
  });
}

const DIRECTION_LABEL = { EXPENSE: "Gasto", INCOME: "Ingreso" };

export function describeProposedAction(action) {
  if (!action || action.type !== "create_movement") return "";
  const kind = DIRECTION_LABEL[action.direction] ?? action.direction;
  const parts = [
    `${kind} de ${formatMoney(action.amount)}`,
    action.walletName ? `en ${action.walletName}` : null,
    action.merchant ? `· ${action.merchant}` : null,
    action.categoryName ? `· ${action.categoryName}` : null,
    action.occurredOn ? `· ${action.occurredOn}` : null,
  ].filter(Boolean);
  return parts.join(" ");
}
