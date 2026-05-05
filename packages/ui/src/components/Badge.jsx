import { cva } from "class-variance-authority";
import { cn } from "../lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[--color-primary] text-white",
        secondary:
          "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
        destructive:
          "bg-red-500/20 border-red-500/45 text-red-800 dark:bg-red-400/20 dark:border-red-400/35 dark:text-red-200",
        success:
          "bg-emerald-500/20 border-emerald-500/45 text-emerald-800 dark:bg-emerald-400/20 dark:border-emerald-400/35 dark:text-emerald-200",
        warning:
          "bg-amber-500/20 border-amber-500/45 text-amber-800 dark:bg-amber-400/20 dark:border-amber-400/35 dark:text-amber-200",
        outline:
          "border-[hsl(var(--border))] text-[hsl(var(--foreground))] bg-transparent",
        glass: "glass-tinted text-[--color-primary] border-indigo-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
