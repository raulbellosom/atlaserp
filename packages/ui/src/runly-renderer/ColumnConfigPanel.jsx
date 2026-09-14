import { useCallback } from "react";
import { GripVertical, RotateCcw } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "../components/Button.jsx";
import { Switch } from "../components/Switch.jsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/Sheet.jsx";
import { cn } from "../lib/utils.js";

function SortableColumnItem({ column, visible, onToggle, isPinned }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.key, disabled: isPinned });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        isDragging
          ? "bg-[hsl(var(--muted))] shadow-md z-10 relative"
          : "hover:bg-[hsl(var(--muted))]/50",
        isPinned && "opacity-60",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex h-11 w-8 cursor-grab items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] active:cursor-grabbing touch-none",
          isPinned && "cursor-not-allowed opacity-40",
        )}
        aria-label={isPinned ? "Columna fija" : "Arrastrar para reordenar"}
        {...(isPinned ? {} : { ...attributes, ...listeners })}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="flex-1 text-sm text-[hsl(var(--foreground))]">
        {column.label}
        {isPinned && (
          <span className="ml-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            (fija)
          </span>
        )}
      </span>

      <Switch
        checked={visible}
        onCheckedChange={() => onToggle(column.key)}
        disabled={isPinned}
        aria-label={`${visible ? "Ocultar" : "Mostrar"} columna ${column.label}`}
      />
    </div>
  );
}

export function ColumnConfigPanel({
  open,
  onOpenChange,
  allColumns,
  columnVisibility,
  onReorder,
  onToggle,
  onReset,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        onReorder(String(active.id), String(over.id));
      }
    },
    [onReorder],
  );

  const sortableIds = allColumns
    .filter((c) => !c.pinned)
    .map((c) => c.key);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-[hsl(var(--border))] px-4 py-4">
          <SheetTitle className="text-base">Configurar columnas</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
              {allColumns.map((column) => (
                <SortableColumnItem
                  key={column.key}
                  column={column}
                  visible={columnVisibility[column.key] !== false}
                  onToggle={onToggle}
                  isPinned={Boolean(column.pinned)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="border-t border-[hsl(var(--border))] px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-[hsl(var(--muted-foreground))]"
            onClick={onReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restablecer columnas por defecto
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
