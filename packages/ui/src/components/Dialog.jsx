import { forwardRef, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/utils.js";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef(function DialogOverlay(
  { className, ...props },
  ref,
) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
});

const DialogContent = forwardRef(function DialogContent(
  { className, style, children, ...props },
  ref,
) {
  const closeRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(null);
  const isDragging = useRef(false);

  function handleDragPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    isDragging.current = true;
  }

  function handleDragPointerMove(e) {
    if (!isDragging.current || dragStartY.current === null) return;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    setDragY(dy);
  }

  function handleDragPointerUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragY > 80) {
      setDragY(0);
      closeRef.current?.click();
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        aria-describedby={undefined}
        {...props}
        style={{
          paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
          ...style,  // caller can override if truly needed
        }}
        className={cn(
          "fixed z-50 glass-strong shadow-xl focus:outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          // ── Mobile: full-width bottom sheet ──────────────────────────────
          "inset-x-0 bottom-0 w-full min-h-[50dvh] max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y",
          "rounded-t-2xl px-5 pt-5 pb-8",
          "data-[state=open]:slide-in-from-bottom-full",
          "data-[state=closed]:slide-out-to-bottom-full",
          "duration-300",
          // ── Desktop md+: centered modal, wider, animations from center ───
          "md:inset-x-auto md:bottom-auto",
          "md:left-1/2 md:top-1/2",
          "md:-translate-x-1/2 md:-translate-y-1/2",
          "md:w-full md:max-w-2xl md:max-h-[90dvh] md:overflow-y-auto md:overscroll-contain",
          "md:rounded-2xl md:p-8",
          "md:data-[state=open]:slide-in-from-top-2",
          "md:data-[state=closed]:slide-out-to-top-2",
          "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
          "md:duration-200",
          className,
        )}
      >
        {/* Drag handle — mobile only; handles swipe-to-dismiss */}
        <div
          className="mx-auto mb-4 h-1.5 w-12 shrink-0 rounded-full bg-[hsl(var(--muted-foreground))]/30 md:hidden cursor-grab active:cursor-grabbing touch-none"
          aria-hidden="true"
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          onPointerCancel={handleDragPointerUp}
        />
        {/* Hidden close button for programmatic swipe-to-dismiss */}
        <DialogPrimitive.Close
          ref={closeRef}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1 text-[hsl(var(--muted-foreground))] opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/40">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

const DialogHeader = function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 text-left mb-4", className)}
      {...props}
    />
  );
};

const DialogFooter = function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-6",
        className,
      )}
      {...props}
    />
  );
};

const DialogTitle = forwardRef(function DialogTitle(
  { className, ...props },
  ref,
) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-base font-semibold leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
});

const DialogDescription = forwardRef(function DialogDescription(
  { className, ...props },
  ref,
) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn(
        "text-sm text-[hsl(var(--muted-foreground))] wrap-break-word",
        className,
      )}
      {...props}
    />
  );
});

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
