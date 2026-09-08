import { cn } from "../lib/utils.js";

// A small pill whose colour is a brand/type accent hex, not a semantic variant.
// Background and border are derived from the accent via color-mix so the same
// accent reads on light and dark surfaces. Use for file-type / asset-type tags.
export function TypeBadge({ accent = "#64748b", className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={{
        color: accent,
        backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
