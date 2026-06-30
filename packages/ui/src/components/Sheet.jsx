import { forwardRef, useEffect, useRef, useState } from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils.js";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = forwardRef(function SheetOverlay(
  { className, ...props },
  ref,
) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
      ref={ref}
    />
  );
});

const sheetVariants = cva(
  "fixed z-50 glass-strong flex flex-col gap-4 p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-200 data-[state=open]:duration-300 focus:outline-none",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 rounded-b-2xl data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 rounded-t-2xl data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 rounded-r-2xl data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 rounded-l-2xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

const SheetContent = forwardRef(function SheetContent(
  {
    side = "right",
    className,
    style,
    children,
    "aria-describedby": ariaDescribedby,
    onOpenAutoFocus,
    ...props
  },
  forwardedRef,
) {
  const isMobile = useIsMobile();
  const effectiveSide =
    isMobile && (side === "right" || side === "left") ? "bottom" : side;

  const contentRef = useRef(null);
  const closeRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(null);
  const isDragging = useRef(false);

  function setRef(node) {
    contentRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function handleDragPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    isDragging.current = true;
    setDragging(true);
  }

  function handleDragPointerMove(e) {
    if (!isDragging.current || dragStartY.current === null) return;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    setDragY(dy);
  }

  function handleDragPointerUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDragging(false);
    if (dragY > 80) {
      setDragY(0);
      closeRef.current?.click();
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
  }

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={setRef}
        aria-describedby={ariaDescribedby}
        tabIndex={-1}
        onOpenAutoFocus={(e) => {
          if (onOpenAutoFocus) {
            onOpenAutoFocus(e);
          } else {
            e.preventDefault();
            contentRef.current?.focus();
          }
        }}
        className={cn(
          sheetVariants({ side: effectiveSide }),
          effectiveSide === "bottom" && "max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y",
          // On non-bottom panels (right/left/top) clip overflow so children can
          // use flex-1 / min-h-0 to fill the panel height without causing scroll
          // on the panel itself.
          effectiveSide !== "bottom" && "overflow-hidden",
          className,
        )}
        {...props}
        style={
          effectiveSide === "bottom"
            ? {
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
                transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
                transition: dragging ? "none" : "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
                ...style,
              }
            : effectiveSide === "right" || effectiveSide === "left"
            ? {
                paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))",
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
                ...style,
              }
            : effectiveSide === "top"
            ? { paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))", ...style }
            : style
        }
      >
        {/* Drag handle — visible only on bottom sheet; handles swipe-to-dismiss */}
        {effectiveSide === "bottom" && (
          <div
            className="mx-auto -mt-1 mb-2 h-1.5 w-12 shrink-0 rounded-full bg-[hsl(var(--muted-foreground))]/50 cursor-grab active:cursor-grabbing touch-none"
            aria-hidden="true"
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={handleDragPointerUp}
            onPointerCancel={handleDragPointerUp}
          />
        )}
        {/* Hidden close button for programmatic swipe-to-dismiss */}
        {effectiveSide === "bottom" && (
          <SheetPrimitive.Close
            ref={closeRef}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1 text-[hsl(var(--muted-foreground))] opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </SheetPrimitive.Close>
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});

const SheetHeader = function SheetHeader({ className, ...props }) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
};

const SheetFooter = function SheetFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-auto",
        className,
      )}
      {...props}
    />
  );
};

const SheetTitle = forwardRef(function SheetTitle(
  { className, ...props },
  ref,
) {
  return (
    <SheetPrimitive.Title
      ref={ref}
      className={cn("text-base font-semibold", className)}
      {...props}
    />
  );
});

const SheetDescription = forwardRef(function SheetDescription(
  { className, ...props },
  ref,
) {
  return (
    <SheetPrimitive.Description
      ref={ref}
      className={cn("text-sm text-[hsl(var(--muted-foreground))]", className)}
      {...props}
    />
  );
});

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
