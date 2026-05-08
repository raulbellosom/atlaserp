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
        destructive: "badge-destructive border",
        success: "badge-success border",
        warning: "badge-warning border",
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
