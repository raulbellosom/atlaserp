import { useRef, useCallback } from "react";
import { ArrowLeft, ArrowRight, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/DropdownMenu.jsx";

const LONGPRESS_MS = 300;

export function ColumnHeaderMenu({
  column,
  canMoveLeft,
  canMoveRight,
  onHide,
  onMoveLeft,
  onMoveRight,
  children,
}) {
  const timerRef = useRef(null);
  const openRef = useRef(null);

  const startLongPress = useCallback(() => {
    timerRef.current = setTimeout(() => {
      openRef.current?.click();
    }, LONGPRESS_MS);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={openRef}
          type="button"
          className="group flex w-full items-center gap-1 text-left focus:outline-none"
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          onTouchCancel={cancelLongPress}
        >
          {children}
          <span className="ml-auto h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-40 group-focus:opacity-40">
            ▾
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[160px]">
        {canMoveLeft && (
          <DropdownMenuItem onClick={() => onMoveLeft(column.key)}>
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            Mover a la izquierda
          </DropdownMenuItem>
        )}
        {canMoveRight && (
          <DropdownMenuItem onClick={() => onMoveRight(column.key)}>
            <ArrowRight className="mr-2 h-3.5 w-3.5" />
            Mover a la derecha
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => onHide(column.key)}
          className="text-[hsl(var(--muted-foreground))]"
        >
          <EyeOff className="mr-2 h-3.5 w-3.5" />
          Ocultar columna
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
