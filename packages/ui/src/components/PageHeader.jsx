import { cn } from "../lib/utils.js";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
