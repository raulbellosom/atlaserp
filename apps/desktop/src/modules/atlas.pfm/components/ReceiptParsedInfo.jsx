// apps/desktop/src/modules/atlas.pfm/components/ReceiptParsedInfo.jsx
// Read-only summary of whatever the vision service extracted from a ticket —
// shared by ReceiptDetailDialog (quick look from the list) and
// ReceiptReviewSheet (the confirm-and-register form).
import { Badge, Separator } from "@atlas/ui";
import { formatMoney } from "../lib/format";

export function ReceiptParsedInfo({ parsed }) {
  if (!parsed) return null;
  const hasExtras =
    parsed.taxAmount != null || parsed.time || parsed.lines?.length > 0 || parsed.confidence != null;
  if (!parsed.merchant && parsed.total == null && !parsed.date && !hasExtras) return null;

  return (
    <div className="space-y-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Detectado por la IA</span>
        {parsed.confidence != null && (
          <Badge variant="outline">Confianza {Math.round(Number(parsed.confidence) * 100)}%</Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[hsl(var(--muted-foreground))]">
        {parsed.merchant && (
          <span className="col-span-2">
            {"Comercio: "}
            <span className="text-[hsl(var(--foreground))]">{parsed.merchant}</span>
          </span>
        )}
        {parsed.date && (
          <span>
            {"Fecha: "}
            <span className="text-[hsl(var(--foreground))]">{parsed.date}</span>
            {parsed.time ? ` ${parsed.time}` : ""}
          </span>
        )}
        {parsed.total != null && (
          <span>
            {"Total: "}
            <span className="text-[hsl(var(--foreground))]">
              {formatMoney(parsed.total, parsed.currency ?? "MXN")}
            </span>
          </span>
        )}
        {parsed.taxAmount != null && (
          <span>
            {"Impuesto: "}
            <span className="text-[hsl(var(--foreground))]">
              {formatMoney(parsed.taxAmount, parsed.currency ?? "MXN")}
            </span>
          </span>
        )}
      </div>
      {parsed.lines?.length > 0 && (
        <>
          <Separator />
          <ul className="space-y-0.5">
            {parsed.lines.map((line, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">{line.description || "—"}</span>
                {line.amount != null && (
                  <span className="shrink-0 text-[hsl(var(--foreground))]">
                    {formatMoney(line.amount, parsed.currency ?? "MXN")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
