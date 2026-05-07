import { forwardRef } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../lib/utils.js";
import { buttonVariants } from "./Button.jsx";

const Pagination = function Pagination({ className, ...props }) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
};

const PaginationContent = forwardRef(function PaginationContent(
  { className, ...props },
  ref,
) {
  return (
    <ul
      ref={ref}
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
});

const PaginationItem = forwardRef(function PaginationItem(
  { className, ...props },
  ref,
) {
  return <li ref={ref} className={cn("", className)} {...props} />;
});

const PaginationLink = function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({
          variant: isActive ? "glass-prominent" : "ghost",
          size,
        }),
        className,
      )}
      {...props}
    />
  );
};

const PaginationPrevious = function PaginationPrevious({
  className,
  ...props
}) {
  return (
    <PaginationLink
      aria-label="Ir a la página anterior"
      size="default"
      className={cn("gap-1 pl-2.5", className)}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Anterior</span>
    </PaginationLink>
  );
};

const PaginationNext = function PaginationNext({ className, ...props }) {
  return (
    <PaginationLink
      aria-label="Ir a la página siguiente"
      size="default"
      className={cn("gap-1 pr-2.5", className)}
      {...props}
    >
      <span className="hidden sm:inline">Siguiente</span>
      <ChevronRight className="h-4 w-4" />
    </PaginationLink>
  );
};

const PaginationEllipsis = function PaginationEllipsis({
  className,
  ...props
}) {
  return (
    <span
      aria-hidden
      className={cn("flex h-9 w-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
};

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
