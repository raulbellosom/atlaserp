import { Loader2 } from "lucide-react";

/**
 * LoadingState — centralized loading indicator for the platform.
 *
 * @param {string}  message  - Loading text (default: "Cargando...")
 * @param {"page"|"section"|"inline"} variant
 *   - "page"    → full viewport centering (min-h-[60dvh])
 *   - "section" → panel/card centering (py-8) — default
 *   - "inline"  → inline-flex beside surrounding content
 * @param {"sm"|"md"} size   - Spinner icon size (default: "md")
 */
export function LoadingState({
  message = "Cargando...",
  variant = "section",
  size = "md",
}) {
  const iconSize = size === "sm" ? 14 : 16;

  if (variant === "page") {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={iconSize} className="animate-spin" />
          {message}
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={iconSize} className="animate-spin" />
        {message}
      </span>
    );
  }

  // default: "section"
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={iconSize} className="animate-spin" />
        {message}
      </div>
    </div>
  );
}
